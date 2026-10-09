# Funciones compartidas por desplegar.ps1 y destruir.ps1.
# Usan los perfiles del AWS CLI que el usuario configuró con `aws configure`;
# aquí nunca se leen ni se escriben credenciales.

# Las plantillas tienen tildes: sin esto el AWS CLI las lee como cp1252 en Windows
$env:AWS_CLI_FILE_ENCODING = 'UTF-8'

function Invocar-Aws {
    param([string]$Perfil, [string]$Region, [string[]]$Argumentos)
    $salida = & aws @Argumentos --profile $Perfil --region $Region
    if ($LASTEXITCODE -ne 0) { throw "Falló 'aws $($Argumentos[0]) $($Argumentos[1])' con el perfil '$Perfil'." }
    return ($salida -join "`n")
}

function Invocar-AwsJson {
    param([string]$Perfil, [string]$Region, [string[]]$Argumentos)
    $json = Invocar-Aws $Perfil $Region ($Argumentos + @('--output', 'json'))
    if ([string]::IsNullOrWhiteSpace($json)) { return $null }
    return ($json | ConvertFrom-Json)
}

function Invocar-AwsTexto {
    param([string]$Perfil, [string]$Region, [string[]]$Argumentos)
    return (Invocar-Aws $Perfil $Region ($Argumentos + @('--output', 'text'))).Trim()
}

function Escribir-Paso {
    param([string]$Mensaje)
    Write-Host ''
    Write-Host "==> $Mensaje" -ForegroundColor Cyan
}

function Verificar-Herramientas {
    param([string[]]$Comandos)
    foreach ($comando in $Comandos) {
        if (-not (Get-Command $comando -ErrorAction SilentlyContinue)) {
            throw "No se encontró '$comando' en el PATH. Instálalo antes de desplegar."
        }
    }
}

# Devuelve el id de cuenta del perfil; falla si el perfil no está configurado
function Obtener-Cuenta {
    param([string]$Perfil, [string]$Region)
    return Invocar-AwsTexto $Perfil $Region @('sts', 'get-caller-identity', '--query', 'Account')
}

# $null si el stack no existe; si no, su estado (CREATE_COMPLETE, ROLLBACK_COMPLETE, ...)
function Obtener-EstadoStack {
    param([string]$Perfil, [string]$Region, [string]$Stack)
    $consulta = "StackSummaries[?StackName=='$Stack' && StackStatus!='DELETE_COMPLETE'].StackStatus | [0]"
    return Invocar-AwsJson $Perfil $Region @('cloudformation', 'list-stacks', '--query', $consulta)
}

function Obtener-Salidas {
    param([string]$Perfil, [string]$Region, [string]$Stack)
    $salidas = @{}
    $lista = Invocar-AwsJson $Perfil $Region @('cloudformation', 'describe-stacks', '--stack-name', $Stack, '--query', 'Stacks[0].Outputs')
    foreach ($salida in $lista) { $salidas[$salida.OutputKey] = $salida.OutputValue }
    return $salidas
}

# Crea o actualiza el stack. Los parámetros vacíos se omiten: en un stack
# existente, `deploy` conserva el valor anterior de los que no se pasan.
function Desplegar-Stack {
    param([string]$Perfil, [string]$Region, [string]$Stack, [string]$Plantilla, [hashtable]$Parametros)
    $overrides = @($Parametros.GetEnumerator() | Where-Object { "$($_.Value)" -ne '' } | ForEach-Object { "$($_.Key)=$($_.Value)" })
    $argumentos = @('cloudformation', 'deploy', '--stack-name', $Stack, '--template-file', $Plantilla,
        '--capabilities', 'CAPABILITY_IAM', '--no-fail-on-empty-changeset', '--parameter-overrides') + $overrides
    & aws @argumentos --profile $Perfil --region $Region | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Falló el despliegue de '$Stack'. Revisa los eventos en la consola de CloudFormation (perfil '$Perfil')."
    }
}

# Un stack cuya creación falló queda en ROLLBACK_COMPLETE y no se puede actualizar
function Limpiar-StackFallido {
    param([string]$Perfil, [string]$Region, [string]$Stack)
    if ((Obtener-EstadoStack $Perfil $Region $Stack) -ne 'ROLLBACK_COMPLETE') { return }
    Write-Host "El stack '$Stack' quedó en ROLLBACK_COMPLETE de un intento anterior; se elimina para recrearlo."
    Invocar-Aws $Perfil $Region @('cloudformation', 'delete-stack', '--stack-name', $Stack) | Out-Null
    Invocar-Aws $Perfil $Region @('cloudformation', 'wait', 'stack-delete-complete', '--stack-name', $Stack) | Out-Null
}

function Publicar-Imagen {
    param([string]$Perfil, [string]$Region, [string]$RepositorioUri, [string]$Contexto, [string]$Tag)
    $registro = $RepositorioUri.Split('/')[0]
    $clave = Invocar-Aws $Perfil $Region @('ecr', 'get-login-password')
    $clave | docker login --username AWS --password-stdin $registro | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "docker login contra $registro falló." }
    docker build --platform linux/amd64 -t "${RepositorioUri}:$Tag" $Contexto | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "docker build de $Contexto falló." }
    docker push "${RepositorioUri}:$Tag" | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "docker push de ${RepositorioUri}:$Tag falló." }
}

# Copia un secreto entre cuentas sin escribirlo a disco. Solo escribe si cambió.
function Copiar-Secreto {
    param([string]$Region, [string]$PerfilOrigen, [string]$ArnOrigen, [string]$PerfilDestino, [string]$ArnDestino)
    $consulta = @('--query', 'SecretString')
    $valor = Invocar-AwsTexto $PerfilOrigen $Region (@('secretsmanager', 'get-secret-value', '--secret-id', $ArnOrigen) + $consulta)
    $actual = Invocar-AwsTexto $PerfilDestino $Region (@('secretsmanager', 'get-secret-value', '--secret-id', $ArnDestino) + $consulta)
    if ($valor -eq $actual) { return }
    Invocar-Aws $PerfilDestino $Region @('secretsmanager', 'put-secret-value', '--secret-id', $ArnDestino, '--secret-string', $valor) | Out-Null
}

function Esperar-Url {
    param([string]$Url, [int]$Intentos = 20)
    for ($i = 1; $i -le $Intentos; $i++) {
        try {
            $respuesta = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
            if ($respuesta.StatusCode -eq 200) { return $true }
        } catch { Start-Sleep -Seconds 15 }
    }
    return $false
}
