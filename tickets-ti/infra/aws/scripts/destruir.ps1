<#
.SYNOPSIS
  Elimina los tres stacks de Tickets TI para dejar de consumir créditos.

.DESCRIPTION
  Sin -Confirmar solo muestra lo que borraría. Las bases RDS dejan un snapshot
  final (DeletionPolicy: Snapshot); al terminar se listan para borrarlos si ya no sirven.

.EXAMPLE
  .\destruir.ps1 -Confirmar
#>
param(
    [switch]$Confirmar,
    [string]$PerfilAuthcore = 'authcore',
    [string]$PerfilDominio = 'dominio',
    [string]$Region = 'us-east-1'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\comun.ps1"

# Orden: frontend primero (usa las APIs como origen), luego los dos servicios
$Objetivos = @(
    @{ Perfil = $PerfilDominio; Stack = 'tickets-frontend' },
    @{ Perfil = $PerfilDominio; Stack = 'tickets-domain-service' },
    @{ Perfil = $PerfilAuthcore; Stack = 'tickets-authcore' }
)

function Vaciar-BucketFrontend {
    $stack = 'tickets-frontend'
    if (-not (Obtener-EstadoStack $PerfilDominio $Region $stack)) { return }
    $bucket = (Obtener-Salidas $PerfilDominio $Region $stack).Bucket
    if ($bucket) { Invocar-Aws $PerfilDominio $Region @('s3', 'rm', "s3://$bucket", '--recursive') | Out-Host }
}

function Eliminar-Stack {
    param([string]$Perfil, [string]$Stack)
    if (-not (Obtener-EstadoStack $Perfil $Region $Stack)) { Write-Host "  $Stack no existe, se omite."; return }
    Write-Host "  Eliminando $Stack (perfil $Perfil); CloudFront y RDS pueden tardar 15-20 min..."
    Invocar-Aws $Perfil $Region @('cloudformation', 'delete-stack', '--stack-name', $Stack) | Out-Null
    Invocar-Aws $Perfil $Region @('cloudformation', 'wait', 'stack-delete-complete', '--stack-name', $Stack) | Out-Null
}

function Mostrar-Snapshots {
    param([string]$Perfil)
    $consulta = 'DBSnapshots[?SnapshotType==`manual`].DBSnapshotIdentifier'
    $snapshots = Invocar-AwsJson $Perfil $Region @('rds', 'describe-db-snapshots', '--query', $consulta)
    foreach ($id in $snapshots) {
        Write-Host "  Snapshot en '$Perfil': $id  ->  aws rds delete-db-snapshot --db-snapshot-identifier $id --profile $Perfil --region $Region"
    }
}

if (-not $Confirmar) {
    Write-Host 'Se eliminarían estos stacks (vuelve a ejecutar con -Confirmar):'
    $Objetivos | ForEach-Object { Write-Host "  $($_.Stack)  (perfil $($_.Perfil))" }
    return
}

Escribir-Paso 'Vaciando el bucket del frontend'
Vaciar-BucketFrontend
Escribir-Paso 'Eliminando stacks'
foreach ($objetivo in $Objetivos) { Eliminar-Stack $objetivo.Perfil $objetivo.Stack }
Escribir-Paso 'Snapshots finales de RDS (cuestan ~2 USD/mes cada uno si los conservas)'
Mostrar-Snapshots $PerfilAuthcore
Mostrar-Snapshots $PerfilDominio
