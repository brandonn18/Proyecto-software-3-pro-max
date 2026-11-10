# Despliegue del domain service en la EC2 del AuthCore

Runbook para desplegar `domain-service-java` en la **misma EC2** donde corre el AuthCore desplegado (Taller 2).
El bytecode se compila para Java 17 y corre sin problemas en el Java 21 que tiene instalada la EC2.

Convenciones: los marcadores `<...>` se reemplazan por valores reales en tu terminal y **nunca** se escriben en el repositorio
ni en capturas. `<IP_EC2>`, `<RUTA_PEM>`, `<ENDPOINT_RDS>`, `<CLAVE>`, `<TU_IP>`, `<TECNICO>`, `<USUARIO>`, `<ADMIN>`.

## Antes de empezar

- Tener el `.pem` de acceso a la EC2 (`<RUTA_PEM>`). No se versiona.
- Para el paso 8, el endpoint `GET /api/health` debe estar desplegado en la versión que se compila.

## 1. Arrancar y dejar habilitado el AuthCore

En la EC2 (`ssh -i <RUTA_PEM> ubuntu@<IP_EC2>`):

```bash
sudo systemctl enable --now login-api
systemctl status login-api --no-pager
```

Verificación sin credenciales: el login debe responder 401 a un usuario inexistente (no conexión rechazada).

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" -d '{"username":"nadie","password":"nada"}'
```

Resultado esperado: `401`.

## 2. Compilar en local y copiar el jar

En tu equipo, desde `tickets-ti/domain-service-java/` (requiere JDK 17 y Maven 3.9+):

```bash
mvn verify                  # las pruebas deben estar en verde
mvn -DskipTests package     # genera target/domain-service-tickets-0.1.0-SNAPSHOT.jar
```

Crear la carpeta de destino en la EC2 con dueño `ubuntu`:

```bash
sudo mkdir -p /opt/domain-service && sudo chown ubuntu:ubuntu /opt/domain-service
```

Copiar el jar desde tu equipo:

```bash
scp -i <RUTA_PEM> target/domain-service-tickets-0.1.0-SNAPSHOT.jar ubuntu@<IP_EC2>:/opt/domain-service/
```

## 3. Crear base y usuario propios en el RDS

La base del domain service es **distinta** de la del AuthCore. En la EC2:

```bash
mysql --version || sudo apt-get install -y mysql-client
mysql -h <ENDPOINT_RDS> -u admin -p
```

Dentro del cliente `mysql` (reemplaza `<CLAVE>` por una clave generada para esta cuenta):

```sql
CREATE DATABASE tickets CHARACTER SET utf8mb4;
CREATE USER 'tickets_app'@'%' IDENTIFIED BY '<CLAVE>';
GRANT ALL ON tickets.* TO 'tickets_app'@'%';
```

Al terminar, borra la línea de `CREATE USER` del historial del cliente: `~/.mysql_history` guarda los comandos en texto plano.
Si el RDS no acepta la conexión, revisa que su Security Group admita el 3306 desde el Security Group de la EC2 (ya debería estar).

## 4. Crear `/etc/domain-service.env` (permisos 600)

Crear el archivo con dueño root y permisos restringidos:

```bash
sudo touch /etc/domain-service.env
sudo chown root:root /etc/domain-service.env
sudo chmod 600 /etc/domain-service.env
```

Copiar la clave compartida desde `jwt.secret` del AuthCore **sin imprimirla en pantalla**. Primero comprueba que la extracción encuentra exactamente una línea (debe imprimir `1`):

```bash
sed -n 's/^ *secret: *//p' /opt/login/application-prod.yml | wc -l
```

Después escribe la variable en el archivo:

```bash
sed -n 's/^ *secret: *//p' /opt/login/application-prod.yml | tr -d '"' | \
  sed 's/^/JWT_SECRET_BASE64=/' | sudo tee -a /etc/domain-service.env > /dev/null
```

Añade el resto de variables (en el editor, con `sudo nano /etc/domain-service.env`):

```
SPRING_PROFILES_ACTIVE=prod
DB_URL=jdbc:mysql://<ENDPOINT_RDS>:3306/tickets
DB_USER=tickets_app
DB_PASSWORD=<CLAVE>
```

Comprueba solo los permisos (no imprimas el contenido):

```bash
sudo ls -l /etc/domain-service.env    # debe mostrar -rw------- root root
```

Si el valor de `JWT_SECRET_BASE64` no coincide con el AuthCore, el paso 8 devolverá 401 a los tokens válidos.

## 5. Instalar la unidad systemd y arrancar el servicio

Desde tu equipo, sube la unidad (versionada en `deploy/domain-service.service`):

```bash
scp -i <RUTA_PEM> deploy/domain-service.service ubuntu@<IP_EC2>:/tmp/
```

En la EC2:

```bash
sudo mv /tmp/domain-service.service /etc/systemd/system/domain-service.service
sudo systemctl daemon-reload
sudo systemctl enable --now domain-service
systemctl status domain-service --no-pager
sudo journalctl -u domain-service -n 100 --no-pager    # logs; añade -f para seguirlos
```

Si `ExecStart` no encuentra Java, comprueba la ruta con `command -v java` y ajusta la línea en `/etc/systemd/system/domain-service.service`.
Tras cualquier cambio en la unidad o en el env, repite `sudo systemctl daemon-reload && sudo systemctl restart domain-service`.

## 6. Security Group: abrir el 8082 solo a tu IP (acción manual del dueño)

En la consola de AWS (no lo hace ningún agente):

1. EC2 → Security Groups → el grupo asociado a la EC2 (`<IP_EC2>`).
2. Editar reglas de entrada → Agregar regla.
3. Tipo: TCP personalizado · Puerto: `8082` · Origen: `<TU_IP>/32`.
4. Guardar. **No** usar `0.0.0.0/0`.

El 3306 del RDS ya admite el Security Group de la EC2; no hay que tocarlo.

## 7. Crear usuarios de prueba en la base del AuthCore

Antes, confirma el nombre de la base del AuthCore leyendo `spring.datasource.url` en `/opt/login/application-prod.yml`.
**No** uses el nombre de la base `tickets` del paso 3: son bases distintas. Al mostrar la línea, oculta el host:

```bash
grep "url:" /opt/login/application-prod.yml | sed 's#//[^/]*/#//<ENDPOINT_RDS>/#'
```

Genera el hash BCrypt de cada usuario con `htpasswd` (paquete `apache2-utils`). Pide la clave por teclado, así no queda en el historial.
La salida tiene la forma `usuario:hash`; `cut` quita el prefijo `usuario:`:

```bash
sudo apt-get install -y apache2-utils
HASH_TECNICO=$(htpasswd -nBC 10 <TECNICO> | cut -d: -f2-)
HASH_USUARIO=$(htpasswd -nBC 10 <USUARIO> | cut -d: -f2-)
```

Inserta los usuarios en la tabla `users` de la base del AuthCore (columnas `username`, `password`, `role`):

```bash
mysql -h <ENDPOINT_RDS> -u admin -p <BD_AUTHCORE>
```

```sql
INSERT INTO users (username, password, role) VALUES ('<TECNICO>', '<HASH_TECNICO>', 'ROLE_TECNICO');
INSERT INTO users (username, password, role) VALUES ('<USUARIO>', '<HASH_USUARIO>', 'ROLE_USER');
```

Si el INSERT falla por columnas obligatorias, revisa `DESCRIBE users;`.
La prueba del paso 8 necesita también un administrador: si no existe, créalo igual con `ROLE_ADMIN` (esta guía no lo incluye).
El `username` del técnico debe ser exactamente el que se usará en `POST /api/tecnicos`.
Los hashes son credenciales derivadas: no los pegues en chats, capturas ni el repositorio.

## 8. Prueba de punta a punta

Desde la EC2 (`localhost`) es lo más simple, porque el Security Group del paso 6 solo abre el 8082. Requiere `jq`.

```bash
sudo apt-get install -y jq
AUTH=http://localhost:8080
DOM=http://localhost:8082

login() {   # pide la clave por teclado; no queda en el historial
  read -rs -p "clave de $1: " P; echo >&2
  jq -nc --arg u "$1" --arg p "$P" '{username:$u,password:$p}' \
    | curl -s -X POST "$AUTH/api/auth/login" -H 'Content-Type: application/json' --data-binary @- \
    | jq -r .token
  unset P
}
TOKEN_ADMIN=$(login <ADMIN>)
TOKEN_TECNICO=$(login <TECNICO>)
TOKEN_USUARIO=$(login <USUARIO>)
```

Comprobaciones (cada una indica el código HTTP esperado):

```bash
# Salud (público): {"status":"UP"}
curl -s $DOM/api/health

# ADMIN registra al técnico y sus categorías: 201
curl -s -o /dev/null -w "%{http_code}\n" -X POST $DOM/api/tecnicos \
  -H "Authorization: Bearer $TOKEN_ADMIN" -H 'Content-Type: application/json' \
  -d '{"username":"<TECNICO>","categorias":["hardware"]}'

# USER crea un ticket: 201 y estado ASIGNADO
RESP=$(curl -s -w "\n%{http_code}" -X POST $DOM/api/tickets \
  -H "Authorization: Bearer $TOKEN_USUARIO" -H 'Content-Type: application/json' \
  -d '{"titulo":"Impresora sin respuesta","descripcion":"La del segundo piso no imprime","tipo":"incidente","categoria":"hardware","prioridad":"alta"}')
echo "$RESP" | tail -n 1                      # 201
CODIGO=$(echo "$RESP" | sed '$d' | jq -r .codigo)
echo "$CODIGO"; echo "$RESP" | sed '$d' | jq -r .estado    # TKT-AAAA-NNNN y ASIGNADO

# TECNICO asignado pasa a EN_PROCESO: 200
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH "$DOM/api/tickets/$CODIGO/status" \
  -H "Authorization: Bearer $TOKEN_TECNICO" -H 'Content-Type: application/json' \
  -d '{"estado":"en_proceso","comentario":"Empiezo"}'

# Negativos: USER no puede gestionar técnicos (403); sin token, 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST $DOM/api/tecnicos \
  -H "Authorization: Bearer $TOKEN_USUARIO" -H 'Content-Type: application/json' \
  -d '{"username":"x","categorias":["hardware"]}'
curl -s -o /dev/null -w "%{http_code}\n" $DOM/api/tickets
```

Si ya hay otros técnicos de `hardware` con menos carga, el ticket puede quedar asignado a otro. En ese caso, el PATCH devolverá 403 con el token de `<TECNICO>`: usa el token del técnico que aparece en `"tecnico"` de la respuesta de creación, o deja el técnico de prueba como único de `hardware`.

## 9. Solución de problemas

| Síntoma | Causa probable | Qué revisar |
|---|---|---|
| 401 con un token recién emitido | `JWT_SECRET_BASE64` distinto del `jwt.secret` del AuthCore | Repite el paso 4 y reinicia el servicio. No imprimas la clave para compararla. |
| 401 con token recién emitido, firma correcta | Reloj desfasado (la tolerancia es de 30 s) | Compara `date` de la EC2 con la hora real; sincroniza con NTP (`timedatectl status`). |
| 401 en `/api/auth/login` | Usuario o clave incorrectos (no es un problema del domain service) | Confirma que el INSERT del paso 7 existe en la base del AuthCore y que la clave es la usada al generar el hash. |
| 403 a todos, incluido ADMIN | El rol en BD no es `ROLE_ADMIN`, o la clave compartida no coincide | Revisa el valor de `role` en la tabla `users` y que `JWT_SECRET_BASE64` sea idéntica al secreto del AuthCore. |
| 403 solo al actualizar un ticket | El técnico no es el asignado | Revisa `tecnico` en la respuesta de creación. |
| `Connection refused` (ECONNREFUSED) | El servicio está detenido o no arrancó | `systemctl status domain-service`; `journalctl -u domain-service`. Si el log dice `Falta JWT_SECRET_BASE64`, revisa `/etc/domain-service.env`. |
| Timeout desde tu equipo | El Security Group no permite tu IP o tu IP cambió | Paso 6: el origen debe ser tu IP actual con `/32`. |
| El servicio arranca y se cae al conectar a la base | `DB_URL`, usuario, clave o permisos del RDS | `GRANT` del paso 3; Security Group del RDS; puerto 3306. |

## Capturas y compartir evidencias

Antes de adjuntar una captura o un log, oculta la IP pública, el ID de cuenta de AWS, los endpoints reales, los tokens y las claves.
Nunca incluyas el contenido de `/etc/domain-service.env` ni el `.pem`.
