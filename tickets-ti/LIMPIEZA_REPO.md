# Ordenar y limpiar el repositorio

Ruta para retirar lo que ya no se usa sin perder nada. **No ejecutar ningún paso hasta cumplir los prerrequisitos.**
Contexto y decisiones abiertas: [PENDIENTES.md](PENDIENTES.md). Reglas de trabajo: [CLAUDE.md](CLAUDE.md).

## 0. Prerrequisitos (todos, por escrito en el chat del grupo o en el PR)

- [x] El PR #7 (`feat/domain-service-java`) está mezclado en `main` (2026-11-26).
- [ ] El equipo **y el profesor** respondieron las decisiones 1 y 2 de la sección 7 de `PENDIENTES.md`. En especial: `authcore/` es la única implementación en el repositorio de HU-1 y HU-3; retirarlo sin confirmar qué AuthCore se evalúa puede costar nota.
- [ ] Si se archiva `authcore/`: el AuthCore desplegado ya está versionado en `tickets-ti/authcore-desplegado/` (fase B de `PENDIENTES.md`).
- [ ] La limpieza va en un **PR aparte**, nunca mezclada con una mejora ni con la entrega.

## 1. Método: etiqueta de respaldo + `git rm`

El historial de Git conserva todo. Se marca el punto exacto con una etiqueta y se borra del árbol de trabajo; recuperar cualquier carpeta cuesta un comando.
No se mueve el código muerto a una carpeta `archivo/`: seguiría apareciendo en búsquedas, en el IDE y en la revisión de las herramientas.

## 2. Inventario (estado verificado el 2026-11-22, archivos versionados entre paréntesis)

| Ruta (bajo `tickets-ti/`) | Qué es | Propuesta | Condición |
|---|---|---|---|
| `domain-service-java/` | **Entregable vigente.** | **Conservar** | — |
| `authcore-desplegado/` | AuthCore desplegado, con secretos fuera (aún no existe). | **Crear** | Fase B de `PENDIENTES.md`. |
| `PENDIENTES.md`, `LIMPIEZA_REPO.md`, `CLAUDE.md` | Documentos de trabajo. | **Conservar** | — |
| `backend/` (63) | Monolito Node/Express, reemplazado. | Retirar | Solo el prerrequisito general. |
| `herramientas/` (9) | `migrar-monolito`: utilidad del monolito. | Retirar con `backend/` | — |
| `domain-service/` (155) | Domain service Node (puerto 3003), anterior al Java. | Retirar | Decisión 2. Las variantes por arquitectura (capas, MVC, OOP) quedan en las etiquetas `archivo/architecture-*` (ver abajo). |
| `frontend/` (48) | React; consume el contrato del servicio Node, no el Java. | Retirar | Decisión 3. Si alguien lo adapta al servicio Java, abrir esa tarea antes. |
| `infra/aws/` (6) | Plantillas ECS de dos cuentas; **no es lo desplegado**. | Retirar | Lo desplegado se describe en `domain-service-java/deploy/DESPLIEGUE.md`. |
| `nginx/` (1), `docker-compose.yml`, `package.json`, `.env.example` | Orquestan el stack antiguo (el compose construye `authcore`, `domain-service`, `frontend` y `nginx`). | Retirar con el stack | Si `authcore/` se **conserva**, no borrar: podar el compose, los scripts de `package.json` y las variables que ya no apliquen. |
| `authcore/` (51) | AuthCore Java del grupo (Gradle). **No es el desplegado.** | Retirar | Decisión 1 + fase B hecha. |
| `README.md`, `COVERAGE_REPORT.md`, `MANUAL_TEST_GUIDE.md` | Describen el monolito (112 pruebas Node). | Retirar, o reescribir el README | El README raíz del repositorio se reescribe en el paso 5. |
| `../Diagramas/` (raíz del repositorio, 8 archivos) | Casos de uso, clases, ER de otra materia. | Retirar | Decisión 5 ya tomada; solo falta el visto bueno de quien los subió. |

Ramas remotas: desde el 2026-11-26 solo existen `main` y `feat/domain-service-java`.

Las ramas `architecture/capas`, `architecture/mvc` y `architecture/oop` (ejercicios de arquitectura sobre el servicio Node) se borraron ese día a pedido de uno de los autores. Antes se guardaron en las etiquetas anotadas `archivo/architecture-capas`, `archivo/architecture-mvc` y `archivo/architecture-oop`, que apuntan exactamente a su último commit. Para recuperar una: `git switch -c architecture/capas archivo/architecture-capas`, o publicarla otra vez con `git push origin archivo/architecture-capas^{commit}:refs/heads/architecture/capas`. No se borra ninguna otra rama ni etiqueta remota sin acuerdo del equipo.

**Sobre `Diagramas/`:** son de otra materia y nada del desarrollo actual los usa (verificado: ningún archivo versionado los referencia). Siguen en `origin`; se retiran en un commit propio de este PR (`git rm -r Diagramas`) y quedan en la etiqueta de respaldo. Si alguien necesita alguno más adelante: `git checkout archivo/pre-limpieza-2026-11 -- Diagramas`.

## 3. Pasos

Trabaja en Git Bash o PowerShell, con `git config core.longpaths true`. Antes de cada commit, `git status` debe mostrar **solo** lo que pretendes incluir; usa siempre rutas concretas (`git commit -m ... -- <rutas>`), nunca `-A`, `.` ni `-a`.

```bash
# 1. Partir de main actualizado
git switch main && git pull
git switch -c chore/limpieza-repo

# 2. Etiqueta de respaldo (marca el último estado completo)
git tag -a archivo/pre-limpieza-2026-11 -m "Estado completo antes de retirar el codigo historico"
git push origin archivo/pre-limpieza-2026-11        # publica la etiqueta: confirmar con el equipo
```

```bash
# 3. Un commit por bloque, para poder revertir cada uno por separado
git rm -r tickets-ti/backend tickets-ti/herramientas
git commit -m "chore: retirar el monolito Node (queda en la etiqueta archivo/pre-limpieza-2026-11)" -- tickets-ti/backend tickets-ti/herramientas

git rm -r tickets-ti/domain-service                  # solo con la decisión 2
git commit -m "chore: retirar el domain service Node (queda en la etiqueta y en las etiquetas archivo/architecture-*)" -- tickets-ti/domain-service

git rm -r tickets-ti/frontend tickets-ti/nginx tickets-ti/docker-compose.yml tickets-ti/package.json tickets-ti/.env.example   # solo con la decisión 3
git commit -m "chore: retirar el frontend React y la orquestacion del stack antiguo" -- tickets-ti/frontend tickets-ti/nginx tickets-ti/docker-compose.yml tickets-ti/package.json tickets-ti/.env.example

git rm -r tickets-ti/infra
git commit -m "chore: retirar las plantillas ECS que no corresponden a lo desplegado" -- tickets-ti/infra

git rm -r tickets-ti/authcore                        # solo con la decisión 1 y la fase B hechas
git commit -m "chore: retirar el AuthCore del grupo (se versiona el desplegado)" -- tickets-ti/authcore

git rm tickets-ti/COVERAGE_REPORT.md tickets-ti/MANUAL_TEST_GUIDE.md tickets-ti/README.md
git commit -m "docs: retirar los documentos que describen el monolito" -- tickets-ti/COVERAGE_REPORT.md tickets-ti/MANUAL_TEST_GUIDE.md tickets-ti/README.md

git rm -r Diagramas                                  # decisión 5: diagramas de otra materia
git commit -m "chore: retirar los diagramas de otra materia (quedan en la etiqueta de respaldo)" -- Diagramas
```

Si algún bloque no tiene luz verde, se omite: cada commit es independiente. Quedan en el disco carpetas ignoradas (`node_modules/`, `build/`); revisa con `git clean -nd tickets-ti/` (simulación) antes de borrar nada a mano.

## 4. Verificación

```bash
# No deben quedar referencias a lo retirado (ajusta el patrón a lo que realmente retiraste)
git grep -nE "tickets-ti/(backend|domain-service/|frontend|authcore/|infra|herramientas)|docker-compose|nginx" -- . ":!tickets-ti/LIMPIEZA_REPO.md" ":!tickets-ti/PENDIENTES.md"

cd tickets-ti/domain-service-java && mvn verify       # debe seguir en verde: no depende de nada retirado
cd ../.. && git status                                 # solo lo previsto
```

## 5. Actualizar referencias (mismo PR)

- [ ] `README.md` (raíz del repositorio): reescribirlo para describir `domain-service-java/`, el AuthCore y los documentos vigentes; quitar el stack Node, las credenciales de prueba del monolito y la URL `Ing_SoftII` (el remoto es `Proyecto-software-3-pro-max`).
- [ ] `tickets-ti/CLAUDE.md`: quitar la lista "Históricas" del mapa de carpetas y lo que ya no exista.
- [ ] `tickets-ti/domain-service-java/README.md`: el párrafo "El grupo construyó su propia versión del domain service en Node.js" y las menciones a `tickets-ti/authcore/`.
- [ ] `.gitignore`: la línea `/tickets-ti/frontend/build/` deja de hacer falta si se retira el frontend.
- [ ] `PENDIENTES.md`: marcar la fase C y anotar el PR.

## 6. Reversión

```bash
git revert <hash-del-commit>                                              # deshace un bloque entero
git checkout archivo/pre-limpieza-2026-11 -- tickets-ti/backend           # recupera solo una carpeta
git switch -c recuperar-legado archivo/pre-limpieza-2026-11               # o abre el estado completo anterior
```

## 7. Fuera del repositorio

En la carpeta local de quien dejó este traspaso hay una carpeta `old/` con documentos de los talleres y un archivo `.pem`, además del `.zip` y la carpeta del proyecto base del profesor.
Nada de eso está versionado ni debe estarlo: el `.pem` es una clave privada de acceso a la EC2, y si alguna vez se compartió dentro de un comprimido hay que pedir al dueño que la reemplace.
