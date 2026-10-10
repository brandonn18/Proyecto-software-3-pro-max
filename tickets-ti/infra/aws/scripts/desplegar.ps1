<#
.SYNOPSIS
  Despliega Tickets TI en dos cuentas de AWS: authcore en una y domain-service + frontend en otra.

.DESCRIPTION
  Idempotente: la primera vez crea todo (unos 30-40 min); las siguientes publica
  imágenes nuevas y actualiza los stacks. Requiere AWS CLI v2, Docker Desktop y Node 18
  (authcore es Java, pero se compila dentro de Docker: no hace falta Java local),
  y dos perfiles configurados por el usuario con `aws configure --profile <nombre>`.

.EXAMPLE
  .\desplegar.ps1 -EmailAlertas tu@correo.com
#>
param(
    [Parameter(Mandatory = $true)][string]$EmailAlertas,
    [string]$PerfilAuthcore = 'authcore',
    [string]$PerfilDominio = 'dominio',
    [string]$Region = 'us-east-1',
    [string]$UsuarioAdministrador = 'admin',
    [string]$EmailAdministrador = '',
    [int]$PresupuestoMensualUsd = 40
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\comun.ps1"

$RaizProyecto = (Resolve-Path "$PSScriptRoot\..\..\..").Path   # tickets-ti/
$Plantillas = (Resolve-Path "$PSScriptRoot\..").Path            # tickets-ti/infra/aws/
$Stacks = @{ authcore = 'tickets-authcore'; dominio = 'tickets-domain-service'; frontend = 'tickets-frontend' }

function Verificar-Cuentas {
    Verificar-Herramientas @('aws', 'docker', 'npm', 'git')
    $cuentaAuthcore = Obtener-Cuenta $PerfilAuthcore $Region
    $cuentaDominio = Obtener-Cuenta $PerfilDominio $Region
    if ($cuentaAuthcore -eq $cuentaDominio) {
        throw "Los perfiles '$PerfilAuthcore' y '$PerfilDominio' apuntan a la misma cuenta ($cuentaAuthcore). Deben ser cuentas distintas."
    }
    Write-Host "authcore       -> cuenta $cuentaAuthcore (perfil $PerfilAuthcore)"
    Write-Host "domain-service -> cuenta $cuentaDominio (perfil $PerfilDominio)"
}

# Tag único por despliegue: commit + fecha, para que ECS siempre arranque tareas nuevas
function Calcular-Tag {
    $commit = (git -C $RaizProyecto rev-parse --short HEAD).Trim()
    return "$commit-$(Get-Date -Format 'yyyyMMddHHmmss')"
}

# Si el frontend ya existe (despliegues posteriores), su URL se pasa desde el inicio
function Obtener-UrlFrontendExistente {
    if (-not (Obtener-EstadoStack $PerfilDominio $Region $Stacks.frontend)) { return '' }
    return (Obtener-Salidas $PerfilDominio $Region $Stacks.frontend).UrlFrontend
}

function Parametros-Servicio {
    param([string]$Servicio, [int]$Puerto, [string]$BaseDatos, [hashtable]$Extra)
    $parametros = @{
        Servicio = $Servicio; PuertoContenedor = $Puerto; NombreBaseDatos = $BaseDatos
        EmailAlertas = $EmailAlertas; PresupuestoMensualUsd = $PresupuestoMensualUsd
    }
    foreach ($clave in $Extra.Keys) { $parametros[$clave] = $Extra[$clave] }
    return $parametros
}

# Fase 1 (solo la primera vez): crea el stack con 0 tareas para tener ECR.
# Fase 2: sube la imagen y arranca 1 tarea con ella.
function Desplegar-Servicio {
    param([string]$Perfil, [string]$Stack, [hashtable]$Parametros, [string]$Tag, [scriptblock]$AntesDeArrancar)
    $plantilla = Join-Path $Plantillas 'servicio.yml'
    Limpiar-StackFallido $Perfil $Region $Stack
    if (-not (Obtener-EstadoStack $Perfil $Region $Stack)) {
        Write-Host "Creando '$Stack' por primera vez (RDS y CloudFront tardan ~20 min)..."
        Desplegar-Stack $Perfil $Region $Stack $plantilla ($Parametros + @{ DesiredCount = 0 })
    }
    $salidas = Obtener-Salidas $Perfil $Region $Stack
    if ($AntesDeArrancar) { & $AntesDeArrancar $salidas }
    Publicar-Imagen $Perfil $Region $salidas.RepositorioUri (Join-Path $RaizProyecto $Parametros.Servicio) $Tag
    Desplegar-Stack $Perfil $Region $Stack $plantilla ($Parametros + @{ DesiredCount = 1; ImageTag = $Tag })
    return (Obtener-Salidas $Perfil $Region $Stack)
}

# authcore (Java) crea sus tablas con Hibernate y el primer administrador al
# arrancar (ADMIN_USERNAME / ADMIN_PASSWORD de Secrets Manager): no hay tarea aparte.
function Desplegar-Authcore {
    param([string]$Tag, [string]$UrlFrontend)
    $extra = @{
        UsuarioAdministrador = $UsuarioAdministrador; EmailAdministrador = $EmailAdministrador
        FrontendUrl = $UrlFrontend; CpuTarea = '512'; MemoriaTarea = '1024'
    }
    $parametros = Parametros-Servicio 'authcore' 8081 'tickets_authcore' $extra
    return (Desplegar-Servicio $PerfilAuthcore $Stacks.authcore $parametros $Tag)
}

function Desplegar-Dominio {
    param([string]$Tag, [string]$UrlFrontend, [hashtable]$Authcore)
    $extra = @{ AuthcoreUrl = $Authcore.UrlApi; FrontendUrl = $UrlFrontend }
    $parametros = Parametros-Servicio 'domain-service' 3003 'tickets_domain' $extra
    # JWT_SECRET y AUTHCORE_INTERNAL_KEY deben ser idénticos en ambas cuentas
    $copiarSecretos = {
        param($salidas)
        Copiar-Secreto $Region $PerfilAuthcore $Authcore.SecretoJwtArn $PerfilDominio $salidas.SecretoJwtArn
        Copiar-Secreto $Region $PerfilAuthcore $Authcore.SecretoClaveInternaArn $PerfilDominio $salidas.SecretoClaveInternaArn
    }
    return (Desplegar-Servicio $PerfilDominio $Stacks.dominio $parametros $Tag $copiarSecretos)
}

function Desplegar-Frontend {
    param([hashtable]$Authcore, [hashtable]$Dominio)
    Limpiar-StackFallido $PerfilDominio $Region $Stacks.frontend
    $parametros = @{ DominioAuthcore = $Authcore.DominioApi; DominioDomainService = $Dominio.DominioApi }
    Desplegar-Stack $PerfilDominio $Region $Stacks.frontend (Join-Path $Plantillas 'frontend.yml') $parametros
    $salidas = Obtener-Salidas $PerfilDominio $Region $Stacks.frontend
    Publicar-Build $salidas
    return $salidas
}

# Sin REACT_APP_API_URL el frontend llama a /api del mismo origen (CloudFront)
function Publicar-Build {
    param([hashtable]$Salidas)
    $dirFrontend = Join-Path $RaizProyecto 'frontend'
    Push-Location $dirFrontend
    try {
        npm install --no-audit --no-fund | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'npm install del frontend falló.' }
        npm run build | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'npm run build del frontend falló.' }
    } finally { Pop-Location }
    $build = Join-Path $dirFrontend 'build'
    $bucket = "s3://$($Salidas.Bucket)"
    Invocar-Aws $PerfilDominio $Region @('s3', 'sync', $build, $bucket, '--delete', '--exclude', 'index.html') | Out-Host
    Invocar-Aws $PerfilDominio $Region @('s3', 'cp', (Join-Path $build 'index.html'), "$bucket/index.html", '--cache-control', 'no-cache') | Out-Host
    Invocar-Aws $PerfilDominio $Region @('cloudfront', 'create-invalidation', '--distribution-id', $Salidas.DistribucionId, '--paths', '/*') | Out-Null
}

# Primera vez: los servicios se crearon sin FrontendUrl porque aún no existía
function Actualizar-FrontendUrl {
    param([string]$UrlFrontend)
    $plantilla = Join-Path $Plantillas 'servicio.yml'
    Desplegar-Stack $PerfilAuthcore $Region $Stacks.authcore $plantilla @{ FrontendUrl = $UrlFrontend }
    Desplegar-Stack $PerfilDominio $Region $Stacks.dominio $plantilla @{ FrontendUrl = $UrlFrontend }
}

function Verificar-Despliegue {
    param([hashtable]$Authcore, [string]$UrlFrontend)
    $comprobaciones = [ordered]@{
        'authcore /api/health'       = "$($Authcore.UrlApi)/api/health"
        'domain-service /api/health' = "$UrlFrontend/api/health"
        'frontend'                   = $UrlFrontend
    }
    foreach ($nombre in $comprobaciones.Keys) {
        $ok = Esperar-Url $comprobaciones[$nombre]
        Write-Host ("  {0,-28} {1}" -f $nombre, $(if ($ok) { 'OK' } else { 'SIN RESPUESTA' })) -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
    }
}

function Mostrar-Resumen {
    param([hashtable]$Authcore, [string]$UrlFrontend)
    Write-Host ''
    Write-Host 'Despliegue terminado.' -ForegroundColor Green
    Write-Host "  Aplicación:     $UrlFrontend"
    Write-Host "  API authcore:   $($Authcore.UrlApi)"
    Write-Host "  Administrador:  $UsuarioAdministrador"
    Write-Host '  Contraseña inicial:'
    Write-Host "    aws secretsmanager get-secret-value --secret-id $($Authcore.SecretoAdminArn) --query SecretString --output text --profile $PerfilAuthcore --region $Region"
}

Escribir-Paso 'Verificando herramientas y cuentas'
Verificar-Cuentas
$tag = Calcular-Tag
$urlFrontend = Obtener-UrlFrontendExistente

Escribir-Paso "authcore (perfil $PerfilAuthcore)"
$authcore = Desplegar-Authcore $tag $urlFrontend

Escribir-Paso "domain-service (perfil $PerfilDominio)"
$dominio = Desplegar-Dominio $tag $urlFrontend $authcore

Escribir-Paso 'Frontend (S3 + CloudFront)'
$frontend = Desplegar-Frontend $authcore $dominio
if ($urlFrontend -ne $frontend.UrlFrontend) {
    Escribir-Paso 'Configurando FRONTEND_URL (CORS y Socket.io) en ambos servicios'
    Actualizar-FrontendUrl $frontend.UrlFrontend
}

Escribir-Paso 'Comprobando que todo responde por HTTPS'
Verificar-Despliegue $authcore $frontend.UrlFrontend
Mostrar-Resumen $authcore $frontend.UrlFrontend
