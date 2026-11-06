# Tracker del tablero BTW Insights

Estado al 5-nov-2026 (hora de Bogotá). Cada tarea dice quién la hace (Opus = la sesión principal, que arma, revisa
e integra; Sonnet o Haiku = subagentes) y qué archivos son suyos. Nadie toca archivos de otra tarea. **Cada tarea
terminada va en su propio commit** (Andrés, 5-nov).

## Decisiones

| Fecha | Decisión | Por qué |
|---|---|---|
| 5-nov | Corre en **Docker** (Compose) en **el servidor de BTW**: Windows Server 2025 → WSL2 → Docker Engine. Nada de servicios de Windows | Andrés. Ese servidor se apaga los domingos: ese día no hay lecturas y el lunes el recolector se pone al día (las APIs dan acumulados) |
| 5-nov | Dominio **insights.btw-one.com** (DNS ya en Cloudflare) | Andrés |
| 5-nov | **Sin Cloudflare Zero Trust.** Entra por sus túneles y Nginx Proxy Manager. El tablero tiene **inicio de sesión propio**, sin registro abierto | Andrés: ya tienen túneles y el proxy |
| 5-nov | **Los videos no se guardan en el tablero.** Fuera: carpeta de archivo, `sha256`, copia en Drive y reproductor | Andrés: "realmente no importa" |
| 5-nov | **Fase 2: solo ver y editar borradores** (con confirmación). Nada se programa ni se publica desde el tablero | Andrés |
| 5-nov | Next 16.4.5 sin `cacheComponents`, TypeScript 6.0.3, Drizzle con postgres.js, Vitest | `typescript-eslint` pide TS < 6.1. Todo es dinámico (hay sesión en cada página) |
| 5-nov | Un solo controlador de base (postgres.js). Neon acepta TCP, así que pasar de base es cambiar `DATABASE_URL` | Vercel queda fuera: su plan Hobby prohíbe el uso comercial |
| 5-nov | **Una lectura por fuente:** si Meta y Zernio dan cifras del mismo post, son dos filas. Para las vistas de IG y FB manda Meta; de Zernio se toma lo que Meta no da (% que se salta en 3 s) | 5-nov: Zernio marcaba 918 vistas del 10 en IG y Meta 1.275 |
| 5-nov | A Meta se le piden todas las métricas en una llamada; si rechaza una, se cae a una por una. El token va en la cabecera, nunca en la URL | Probado el 5-nov con las APIs reales |
| 5-nov | `total_video_complete_views` no se pide en Facebook | Meta no la da para Reels: llega vacía en los 11 |
| 5-nov | "Fecha y texto" nunca asigna un reel que ya tiene otra publicación **publicada** en esa red: queda en "Sin asignar" | Error real: el 04-G4 del 28-oct caía en el 04C-G1 |
| 5-nov | Una fila mal formada de `seguimiento.csv` se salta con aviso; no se adivina qué columna se corrió | El 5-nov las filas del 14 y del 13 traen una coma sin comillas (26 columnas) |
| 5-nov | Llaves copiadas de `btw-videos/.env.local` al de este repo, solo las 4 del tablero, sin mostrarlas | Andrés lo pidió |

## Decisiones por revisar (sesión del servidor, noche del 6-nov)

Tomadas sin preguntar, eligiendo lo más seguro y reversible (`docs/handoff-servidor.md`). Andrés las revisa.

| # | Decisión | Por qué | Cómo deshacerla |
|---|---|---|---|
| 1 | **Sin push ni PR:** los commits quedan locales en `fase-1` | El servidor no tiene credenciales de GitHub (`git push` pide usuario) y `gh` no tiene sesión. No se buscaron credenciales | `gh auth login` y `git push origin fase-1`; luego el PR (ver "Para Andrés") |
| 2 | Node 24 instalado en `~/.local/node24` (solo para el usuario, verificado con SHA256 de nodejs.org) | El sistema tiene Node 20 y el proyecto pide >= 24. No se tocó el Node del sistema | `rm -rf ~/.local/node24` |
| 3 | La base de **pruebas** corre con `synchronous_commit=off` | En WSL2 cada commit tarda ~28 ms y las pruebas del recolector pasaban de 5 s. Solo afecta a `btw_tablero_prueba*` | Quitar la línea en `pruebas/preparar-bd.ts` |
| 4 | `PROXY_RED=proxy-net` | Es la red de `nginx-proxy` y `cloudflare-tunnel` (`docker inspect`, sin cambiarlos) | Cambiar en `.env.produccion` |
| 5 | Los archivos de `~/btw-respaldos` se movieron a `respaldos/` (ignorado por git); los tar se extrajeron en `datos/btw-videos/` (ignorado) y `BTW_VIDEOS_DIR` apunta ahí | Lo pidió Andrés | — |
| 6 | La base de **desarrollo** del servidor (`127.0.0.1:5434`) se llenó con `btw_tablero.dump` | Para probar las pantallas con datos reales | `docker compose down -v` del compose de desarrollo |
| 7 | `.env.produccion` creado con secretos nuevos al azar (nunca impresos) y las 4 llaves de `respaldos/llaves-api.env` | Paso 0 del traspaso | Borrar el archivo y regenerar |

## Para Andrés al levantarse

El tablero ya corre en Docker en este servidor (proyecto `btw-insights`: `db`, `app`, `cron` cada hora y `respaldo`
diario a las 3:00), con los datos del dump del 6-nov y una recolección real hecha. Falta lo que necesita tu inicio
de sesión:

1. **Empujar y abrir el PR** (no pude: el servidor no tiene credenciales de GitHub). Desde este repo:
   `gh auth login`, luego `git push origin fase-1`. `main` no existe en GitHub: créala desde el primer commit
   (`git push origin $(git rev-list --max-parents=0 HEAD):refs/heads/main`) y abre el PR sin fusionar:
   `gh pr create --base main --head fase-1 --title "Tablero BTW Insights: fases 1 y 2" --body-file docs/pr.md`.
2. **Nginx Proxy Manager** (`http://127.0.0.1:81` en el servidor): *Add Proxy Host* →
   - Domain: `insights.btw-one.com`; Scheme `http`; Forward Hostname `btw-insights-app`; Port `3000`;
   - activa *Block Common Exploits* y *Websockets Support*;
   - SSL: igual que tus otros dominios (si Cloudflare termina el HTTPS y el túnel llega a NPM por HTTP, no hace
     falta certificado en NPM).
3. **Túnel de Cloudflare** (Zero Trust → Networks → Tunnels → el túnel de este servidor → *Public Hostname*):
   `insights.btw-one.com` → el mismo servicio que usan tus otros dominios (si van a NPM: `http://nginx-proxy:80`;
   si van directo: `http://btw-insights-app:3000`). Sin aplicación de Access delante (decidido el 5-nov).
4. **Probar:** `https://insights.btw-one.com/api/salud` debe dar `{"ok":true,"base":"ok"}` y cualquier otra página
   debe mandarte a `/entrar`.
5. **Registrar tu llave de acceso:** abre en el celular el enlace de invitación que dejé en la terminal de esta
   sesión (vale 24 h y un solo uso; no está en git). Si se venció o se perdió, crea otro:
   `docker compose --env-file .env.produccion -f docker-compose.prod.yml run --rm migrar node --conditions=react-server --import tsx scripts/invitar.ts "Andrés"`.
   La llave solo sirve en `insights.btw-one.com` (no por IP ni por localhost).
6. **`seguimiento.csv`** (en btw-videos): las filas del 13 y el 14 tienen una celda con coma sin comillas; ponla
   entre comillas y vuelve a importar.
7. **Asignar a mano** los 2 posts del 28-oct en "Sin asignar" (deben ser del 04-G4).

## Pendiente de Andrés

1. **`seguimiento.csv` (en btw-videos):** las filas del 14 y del 13 tienen una celda con coma sin comillas (la de
   la etiqueta de IA). Ponerla entre comillas y volver a correr `npm run importar`.
2. ~~Red de Nginx Proxy Manager~~: resuelto, es `proxy-net` (decisión 4).
3. **Inicio de sesión:** passkey (decidido el 6-nov). Falta saber quiénes más entran, además de Andrés.
4. **Asignar a mano** los 2 posts del 28-oct ("¿Cuánto te quedó hoy?", TikTok y Facebook): deben ser del 04-G4.

## Tareas — Fase 1

| ID | Tarea | Quién | Estado | Archivos |
|---|---|---|---|---|
| T01 | Base: Next, TS, Drizzle, Postgres local en `127.0.0.1:5434`, esquema v1, config y banco de pruebas con base propia | Opus | ✅ | `package.json`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, `vitest.config.ts`, `docker-compose.yml`, `src/servidor/{config,tipos}.ts`, `src/servidor/db/*`, `migraciones/`, `pruebas/*.ts`, `scripts/{migrar,preparar-env}.*` |
| T02 | Respuestas reales de las APIs (sin llaves) y copias de `btw-videos` | Opus | ✅ | `scripts/grabar-fixtures.ts`, `pruebas/fixtures/` |
| T06 | Clientes HTTP de Zernio y Meta: solo GET, reintentos, límite de 50 por minuto, errores sin llaves | Sonnet | ✅ | `src/servidor/fuentes/*` |
| T03 | Normalización: Zernio (analytics, cola, seguidores) y Meta (FB, IG, cuentas). `zernioPostId` = `latePostId`; los posts subidos a mano no lo traen | Sonnet | ✅ | `src/servidor/normalizar/*` |
| T04a | Lectores simples: `texto.txt` (incluye "UN SOLO ARCHIVO PARA LAS TRES REDES"), nombres de carpeta, calendario, `zernio-borradores.csv` | Haiku | ✅ | `src/servidor/importar/{texto,carpetas,calendario,borradores}.ts` |
| T04b | Lectores con reglas: `seguimiento.csv` (salta filas mal formadas) y CSV de métricas | Sonnet + Opus | ✅ | `src/servidor/importar/{seguimiento,metricas-csv}*.ts` |
| T05 | Emparejar publicaciones con reels (id, etiqueta, fecha + texto + duración, o "Sin asignar") | Sonnet + Opus | ✅ | `src/servidor/emparejar*.ts` |
| T02b | Guardado en la base: publicación, lectura, cuenta y alertas, sin duplicar ni pisar | Opus | ✅ | `src/servidor/guardar*.ts` |
| T07 | `npm run importar`: 21 reels, 49 publicaciones y 36 lecturas; 2 en "Sin asignar". Idempotente y no pisa lo editado | Sonnet | ✅ | `src/servidor/importar/a-la-base*.ts`, `scripts/importar.ts` |
| T08 | Recolector: plan de lecturas, candado con `corrida`, alertas, `npm run recolectar` y `POST /api/recolectar`. Probado con las APIs reales: 36 lecturas y luego 0 repetidas | Opus + Sonnet | ✅ | `src/servidor/recolector/*`, `src/app/api/recolectar/`, `scripts/recolectar.ts` |
| T08b | Rellenar huecos (domingos) con el historial diario de Zernio | Sonnet | ✅ sin relleno: el timeline es acumulado, pero solo existe desde el 5-nov y no trae la hora (ver `docs/specs/T08b.md`) | `scripts/grabar-fixtures.ts`, fixture del timeline |
| T11 | Docker de producción: imagen `app` (326 MB, amd64 probada) y `herramientas`; Compose con base, migración, app, cron cada hora y respaldo diario | Sonnet | ✅ | `Dockerfile`, `docker-compose.prod.yml`, `docker/*`, `src/app/api/salud/`, `docs/despliegue.md` |
| T09 | Inicio de sesión con llave de acceso (passkey), invitaciones de un solo uso, sesión en la base, `proxy.ts` y cabeceras | Sonnet + Opus | ✅ (53 pruebas; probado en modo producción) | `src/servidor/acceso/*`, `src/proxy.ts`, `src/app/{entrar,registrar,api/acceso}/`, `scripts/invitar.ts`, migración 0001 |
| T10 | Pantallas: Hoy, Videos, Detalle, Cola de 14 días y Sin asignar (celular primero; cada cifra con su fuente y antigüedad) | Sonnet | ✅ (229 pruebas; pulido en T10b) | `src/app/(tablero)/*`, `src/componentes/*`, `src/servidor/consultas/*` |
| T10b | Pulido en el celular: tarjetas en `/videos`, "día sin video" por celda, fechas cortas, capturas a 375 y 1440 px | Sonnet | ✅ | `src/app/(tablero)/{videos,cola}/`, `docs/capturas/` |
| T12 | Roles de la base (dueño, app y lectura), copia del respaldo a una carpeta del host y restauración probada | Sonnet | ✅ | `scripts/roles.*`, `docker/respaldo/*`, `docker-compose.prod.yml` |
| T13 | Prueba de portabilidad (base nueva), búsqueda de secretos en `.next` y en la imagen, README, `docs/nube.md`, `.env.example` | Haiku + Opus | ✅ (resultado en `docs/specs/T13.md`) | `README.md`, `docs/*`, `.env.example`, `scripts/revisar-secretos.*` |
| T14 | Desplegar en el servidor de BTW: Compose entero (`btw-insights`) unido a `proxy-net`, dump restaurado, recolección y respaldo probados | Opus | ✅ 6-nov 01:19 (falta NPM y el túnel: ver "Para Andrés") | `docker-compose*.yml`, `scripts/migrar.ts`, `docs/specs/T14.md` |

**Siguiente:** la sesión del servidor sigue con `docs/handoff-servidor.md`: fase 1 (T09, T10b, T08b, T12, T13 y T14), fase 2 (T15 a T21) y, de la fase 3, lo que no necesita a Andrés.

## Fase 2

- Ver y editar los borradores de Zernio (texto y fecha), siempre con `isDraft: true` y con confirmación.
- Ideas, leads, alertas completas y la tarea de las 8:00 de `btw-videos` leyendo del tablero.

## Investigación de servidores (5-nov; se eligió el servidor propio)

Gratis y siempre prendido solo sirve Oracle Always Free (A1: 2 OCPU y 12 GB), con riesgos: recupera la VM si está
ociosa, a veces no hay capacidad, pide tarjeta y cambia el plan sin aviso. Descartados: Vercel Hobby (uso comercial
prohibido), Render Free (se duerme y el Postgres expira a los 30 días), Fly.io (sin plan gratis), Google e2-micro
(1 GB de RAM), AWS y Azure (solo créditos o 12 meses) y Cloudflare Workers Free (10 ms de CPU).
