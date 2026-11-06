# Despliegue (Docker)

Corre en cualquier Linux con Docker Engine y Compose v2: VM ARM64 (Oracle Ampere) o el servidor de BTW
(x86_64, WSL2). Proyecto de Compose: `btw-insights`. Piezas: `db`, `migrar` (una vez), `app`, `cron`, `respaldo`.
Nada publica puertos; el proxy entra por la red externa.

## 1. Construir

En el servidor, desde la raíz del repositorio:

```bash
docker compose --env-file .env.produccion -f docker-compose.prod.yml build
```

Multi-arquitectura (desde un PC, para subir a un registro y bajar en el servidor):

```bash
docker buildx create --use --name btw   # una sola vez
docker buildx build --platform linux/amd64,linux/arm64 --target app \
  -t REGISTRO/btw-insights-app:1.0.0 --push .
docker buildx build --platform linux/amd64,linux/arm64 --target herramientas \
  -t REGISTRO/btw-insights-herramientas:1.0.0 --push .
```

Con imágenes del registro, pon `VERSION=1.0.0` en `.env.produccion` y cambia `image:` de `app` y `migrar` al
registro (o etiqueta local con `docker tag`). Las imágenes `cron` y `respaldo` son pequeñas y se construyen en el
servidor.

## 2. Crear `.env.produccion`

Junto al compose, fuera de git (`chmod 600`). Nunca pegues los valores en el chat ni en el repositorio.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `POSTGRES_PASSWORD` | sí | contraseña del dueño `btw` (la usan `db`, `migrar` y `respaldo`) |
| `POSTGRES_APP_PASSWORD` | sí | contraseña de `btw_app`, el rol con el que se conecta `app` |
| `POSTGRES_LECTURA_PASSWORD` | sí | contraseña de `btw_lectura` (solo lee; para consultas a mano) |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGEN`, `WEBAUTHN_RP_NOMBRE` | sí | inicio de sesión con passkey (`insights.btw-one.com`, `https://insights.btw-one.com`, `BTW Insights`) |
| `RESPALDO_HOST_DIR` | no | carpeta del servidor donde se copia cada respaldo (por defecto `./respaldos/produccion`) |
| `RESPALDO_HOST_PROPIETARIO` | no | `uid:gid` dueño de esas copias (por defecto root); ej. `1000:1000` |
| `RECOLECTOR_SECRETO` | sí | secreto del Bearer de `/api/recolectar` (`app` y `cron`) |
| `META_PAGE_TOKEN`, `META_PAGE_ID`, `IG_USER_ID`, `GRAPH_VERSION` | no | Meta |
| `ZERNIO_API_KEY` | no | Zernio |
| `PROXY_RED` | no | red externa del proxy (por defecto `proxy`) |
| `VERSION` | no | etiqueta de las imágenes (por defecto `local`) |

Genera las contraseñas con `openssl rand -hex 24` (solo letras y números: van dentro de una URL).

Crea la red del proxy si no existe: `docker network create proxy`. Conecta Nginx Proxy Manager o `cloudflared` a
esa red y apúntalos a `http://app:3000`.

## 3. Levantar

```bash
docker compose --env-file .env.produccion -f docker-compose.prod.yml up -d
```

`migrar` corre las migraciones y luego los roles (`scripts/roles.sql`), como dueño, cuando `db` está sana; `app`
arranca solo si terminó bien. Para probar desde el
servidor, descomenta `ports: 127.0.0.1:3100:3000` en `app` y abre `http://127.0.0.1:3100/api/salud`.

Comandos de una vez (por ejemplo la importación inicial) con la imagen `herramientas`; las variables llegan por
entorno, sin `.env.local`, y Node corre `tsx` directo:

```bash
docker compose --env-file .env.produccion -f docker-compose.prod.yml run --rm migrar \
  node --import tsx scripts/importar.ts
```

## 4. Ver los registros

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs --tail 50 cron respaldo
```

El `cron` registra una línea por hora con el código HTTP, sin el secreto ni la respuesta.

## 5. Roles de la base

| Rol | Quién lo usa | Permisos |
|---|---|---|
| `btw` | `migrar`, `respaldo` | dueño: crea y cambia tablas |
| `btw_app` | `app` | SELECT, INSERT y UPDATE; DELETE solo en `sesion`, `desafio` e `invitacion`; sin DDL |
| `btw_lectura` | consultas a mano | solo SELECT |

`migrar` los crea o actualiza en cada arranque (es idempotente, también cambia las contraseñas si cambiaron en
`.env.produccion`). Las tablas nuevas de futuras migraciones heredan los mismos permisos. Para correrlo a mano:
`... run --rm migrar node --import tsx scripts/roles.ts`.

Las tablas con `generated always as identity` no piden permiso sobre su secuencia. Si algún día se usa `serial`,
habrá que dar `USAGE` sobre esa secuencia en `scripts/roles.sql`.

## 6. Respaldar y restaurar

Diario a las 3:00 (Bogotá), `pg_dump -Fc`. Cada respaldo queda en dos sitios, con los últimos 30 en cada uno:
el volumen `respaldos` y la carpeta del servidor `RESPALDO_HOST_DIR` (por defecto `./respaldos/produccion`). Los
archivos son `0600`, de root salvo que pongas `RESPALDO_HOST_PROPIETARIO`. Si la copia al host falla, el respaldo del
volumen queda igual y el registro lo dice. Llevar esa carpeta a Drive u otro sitio es decisión aparte.

Uno ahora:

```bash
docker compose --env-file .env.produccion -f docker-compose.prod.yml exec respaldo respaldar.sh
docker compose --env-file .env.produccion -f docker-compose.prod.yml exec respaldo ls -lh /respaldos /respaldos-host
```

**Probar que el último respaldo sirve** (no toca la base real: restaura en `btw_insights_restauracion`, compara los
conteos de cada tabla con la base original y la borra). Con `--respaldar-antes` hace primero un respaldo nuevo, así
los conteos coinciden aunque haya datos nuevos:

```bash
docker compose --env-file .env.produccion -f docker-compose.prod.yml exec respaldo probar-restauracion.sh --respaldar-antes
```

Debe terminar con `OK: los conteos coinciden`. Conviene correrlo una vez al mes.

**Restaurar de verdad** (reemplaza todo el contenido de la base):

```bash
F="--env-file .env.produccion -f docker-compose.prod.yml"
docker compose $F stop app cron
docker compose $F run --rm --entrypoint restaurar.sh respaldo btw-insights-AAAAMMDD-HHMMSS.dump
docker compose $F run --rm migrar     # vuelve a dar los permisos a btw_app y btw_lectura
docker compose $F up -d
```

Copia más lejos (Drive, S3...): `docker/respaldo/despues.sh` recibe la ruta del respaldo en `$1` tras cada respaldo
exitoso. Hoy no hace nada.

## 7. Actualizar a una versión nueva

```bash
git pull
docker compose --env-file .env.produccion -f docker-compose.prod.yml exec respaldo respaldar.sh   # por si acaso
docker compose --env-file .env.produccion -f docker-compose.prod.yml build
docker compose --env-file .env.produccion -f docker-compose.prod.yml up -d
```

Compose recrea lo que cambió y `migrar` vuelve a correr antes de `app`. Si algo sale mal, vuelve a la versión
anterior (`git checkout`, `build`, `up -d`) y, si hubo migración, restaura el respaldo.
