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
| `POSTGRES_PASSWORD` | sí | contraseña de la base (la usan `db`, `migrar`, `app` y `respaldo`) |
| `RECOLECTOR_SECRETO` | sí | secreto del Bearer de `/api/recolectar` (`app` y `cron`) |
| `META_PAGE_TOKEN`, `META_PAGE_ID`, `IG_USER_ID`, `GRAPH_VERSION` | no | Meta |
| `ZERNIO_API_KEY` | no | Zernio |
| `PROXY_RED` | no | red externa del proxy (por defecto `proxy`) |
| `VERSION` | no | etiqueta de las imágenes (por defecto `local`) |

Crea la red del proxy si no existe: `docker network create proxy`. Conecta Nginx Proxy Manager o `cloudflared` a
esa red y apúntalos a `http://app:3000`.

## 3. Levantar

```bash
docker compose --env-file .env.produccion -f docker-compose.prod.yml up -d
```

`migrar` corre las migraciones cuando `db` está sana y `app` arranca solo si terminó bien. Para probar desde el
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

## 5. Respaldar y restaurar

Diario a las 3:00 (Bogotá), `pg_dump -Fc`, volumen `respaldos`, se conservan los últimos 30. Para uno ahora:

```bash
docker compose --env-file .env.produccion -f docker-compose.prod.yml exec respaldo respaldar.sh
docker compose --env-file .env.produccion -f docker-compose.prod.yml exec respaldo ls -lh /respaldos
```

Restaurar (reemplaza todo el contenido de la base):

```bash
F="--env-file .env.produccion -f docker-compose.prod.yml"
docker compose $F stop app cron
docker compose $F run --rm --entrypoint restaurar.sh respaldo btw-insights-AAAAMMDD-HHMMSS.dump
docker compose $F up -d
```

Copia fuera del servidor: edita `docker/respaldo/despues.sh` (recibe la ruta del respaldo en `$1` tras cada respaldo
exitoso) y reconstruye `respaldo`. Hoy no hace nada.

## 6. Actualizar a una versión nueva

```bash
git pull
docker compose --env-file .env.produccion -f docker-compose.prod.yml exec respaldo respaldar.sh   # por si acaso
docker compose --env-file .env.produccion -f docker-compose.prod.yml build
docker compose --env-file .env.produccion -f docker-compose.prod.yml up -d
```

Compose recrea lo que cambió y `migrar` vuelve a correr antes de `app`. Si algo sale mal, vuelve a la versión
anterior (`git checkout`, `build`, `up -d`) y, si hubo migración, restaura el respaldo.
