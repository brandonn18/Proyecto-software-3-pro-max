# Despliegue en AWS — dos cuentas

authcore vive en una cuenta de AWS y domain-service + frontend en otra. No comparten
VPC ni base de datos: se comunican solo por HTTPS, y el JWT se valida con un
`JWT_SECRET` que ambas cuentas guardan en su propio Secrets Manager.

```
                       Navegador (HTTPS)
                              │
  CUENTA DOMINIO              ▼
  ┌───────────────────────────────────────────────┐
  │ CloudFront frontend (tickets-frontend)        │
  │   /               → S3 privado (React build)  │
  │   /api/auth/*     ─────────────────────────┐  │
  │   /api/*, /socket.io/* ─┐                  │  │
  │                         ▼                  │  │
  │ CloudFront API → ALB interno → ECS Fargate │  │
  │   (domain-service)            │            │  │
  │                               ▼            │  │
  │                    RDS PostgreSQL privado  │  │
  └───────────────────────────────┬────────────┼──┘
          AUTHCORE_URL (HTTPS)    │            │
  CUENTA AUTHCORE                 ▼            ▼
  ┌───────────────────────────────────────────────┐
  │ CloudFront API → ALB interno → ECS Fargate    │
  │   (authcore, Java 21)         │               │
  │                               ▼               │
  │                    RDS PostgreSQL privado     │
  └───────────────────────────────────────────────┘
```

| Archivo | Qué crea |
|---|---|
| `servicio.yml` | Una plantilla para **cada** servicio: VPC, RDS, ECR, ECS Fargate, ALB interno, CloudFront (VPC origin), secretos y un presupuesto con alertas. |
| `frontend.yml` | S3 privado y CloudFront del frontend con el mismo enrutamiento que `nginx/nginx.conf`. |
| `scripts/desplegar.ps1` | Orquesta todo; es idempotente (sirve para el primer despliegue y para los siguientes). |
| `scripts/destruir.ps1` | Borra los tres stacks para dejar de consumir créditos. |

## Requisitos (una sola vez)

1. **AWS CLI v2**: `winget install Amazon.AWSCLI` (cierra y abre la terminal).
2. **Docker Desktop** encendido y **Node 18+**.
3. En **cada cuenta**, crea un usuario IAM con acceso por CLI (para la materia,
   `AdministratorAccess` es lo más simple) y genera sus access keys.
4. Configura un perfil por cuenta. Lo haces tú en tu terminal; las claves nunca
   pasan por el repo ni por Claude Code:

   ```powershell
   aws configure --profile authcore   # claves de la cuenta 1, región us-east-1
   aws configure --profile dominio    # claves de la cuenta 2, región us-east-1
   aws sts get-caller-identity --profile authcore
   aws sts get-caller-identity --profile dominio   # debe mostrar OTRA cuenta
   ```

## Desplegar

```powershell
cd tickets-ti\infra\aws\scripts
.\desplegar.ps1 -EmailAlertas tu@correo.com
```

Si PowerShell bloquea el script: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

La primera vez tarda **30–40 minutos** (RDS y CloudFront son lentos de crear). El script:

1. Verifica que los dos perfiles sean cuentas distintas.
2. **authcore** (Java / Spring Boot): crea el stack, compila la
   imagen (Gradle corre dentro de Docker) y arranca la tarea. Al iniciar, Hibernate crea
   las tablas y se crea el primer administrador si no existe (idempotente).
3. **domain-service**: crea el stack, copia `JWT_SECRET` y `AUTHCORE_INTERNAL_KEY`
   desde Secrets Manager de authcore al suyo (en memoria, sin tocar disco), sube la imagen y arranca.
4. **frontend**: crea S3 + CloudFront, compila React y lo sube.
5. Configura `FRONTEND_URL` (CORS y Socket.io) en ambos servicios.
6. Comprueba por HTTPS los health checks y muestra la URL de la aplicación.

Entra con el usuario `admin` (o lo que pases en `-UsuarioAdministrador`). La contraseña
inicial la genera Secrets Manager; el resumen final imprime el comando para leerla.
authcore no expone cambio de contraseña, así que guárdala en un lugar seguro.

Para publicar cambios de código, vuelve a ejecutar el mismo comando: construye
imágenes nuevas, ECS las despliega sin downtime y, si una falla el health check,
el circuit breaker regresa a la versión anterior.

## Costos y créditos

Aproximado por cuenta, en `us-east-1`:

| Recurso | USD/mes |
|---|---|
| ALB | ~16 |
| RDS db.t4g.micro + 20 GB gp3 | ~14 |
| Fargate: domain-service 0.25 vCPU / 0.5 GB · authcore 0.5 vCPU / 1 GB (JVM) | ~9 / ~18 |
| IPv4 públicas | ~4–8 |
| CloudFront, Secrets Manager, ECR, logs | ~2 |

Unos **35–45 USD/mes por cuenta** (la de authcore, ~9 USD más por la JVM). Cada stack crea un presupuesto (`-PresupuestoMensualUsd`,
40 por defecto) que te avisa al correo al llegar al 80 % y cuando el pronóstico supera
el 100 %. Mide el gasto **antes** de aplicar créditos, para que sepas a qué ritmo se consumen.

**Cuando no lo estés usando, destrúyelo** y vuelve a desplegar antes de la presentación:

```powershell
.\destruir.ps1             # muestra qué borraría
.\destruir.ps1 -Confirmar  # borra (15–25 min)
```

RDS deja un snapshot final de cada base; el script lista los comandos para borrarlos.

## Decisiones de diseño

- **CloudFront delante de todo**: da HTTPS con certificado válido sin comprar dominio
  y soporta WebSockets (Socket.io).
- **ALB interno + CloudFront VPC origin**: el ALB no tiene IP pública; la única
  entrada a cada servicio es su CloudFront.
- **Sin NAT Gateway** (~32 USD/mes menos por cuenta): las tareas están en subredes
  públicas con IP pública solo de salida; su security group únicamente acepta tráfico del ALB.
- **RDS privado**: solo acepta conexiones del security group de las tareas.
- **Secretos**: credenciales de RDS, `JWT_SECRET`, `AUTHCORE_INTERNAL_KEY` y la contraseña
  del admin se generan en Secrets Manager y ECS los inyecta como variables de entorno.
- **`TRUST_PROXY=3`**: navegador → CloudFront frontend → CloudFront API → ALB → contenedor,
  para que el rate limit de domain-service vea la IP real.

### Limitaciones conocidas

- `/internal/*` de authcore es alcanzable por su CloudFront y solo lo protege
  `X-Internal-Key` (64 caracteres aleatorios) sobre HTTPS, igual que en el diseño de
  CLAUDE.md. Un siguiente paso sería AWS WAF o una cabecera de origen secreta.
- authcore no limita intentos de login ni bloquea cuentas.
  Se mitiga con una regla de rate limit de AWS WAF sobre `/api/auth/login`.
- Email: sin variables `EMAIL_*`, domain-service no envía correos (registra el error en
  logs sin fallar). authcore no envía correos. Para activarlo, agrega SMTP a las plantillas.
- Una sola tarea por servicio y RDS sin Multi-AZ: suficiente para la materia, no para producción.

## Depuración

```powershell
# Logs en vivo de un servicio
aws logs tail /ecs/tickets-authcore --follow --profile authcore
aws logs tail /ecs/tickets-domain-service --follow --profile dominio

# Estado del stack si un despliegue falla
aws cloudformation describe-stack-events --stack-name tickets-authcore --max-items 15 --profile authcore
```
