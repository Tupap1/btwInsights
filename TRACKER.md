# Tracker del tablero BTW Insights

Estado al 6-nov-2026, tarde (hora de Bogotá): fases 1 y 2 desplegadas en Docker en el servidor de BTW. De la fase 3 quedaron hechos los comentarios del inbox (T22); además el tablero quedó solo para ver (T24) y se actualiza al entrar (T25). La pauta de Meta (T23) espera un token con `ads_read`. No hay fase 4. Cada tarea dice quién la hace (Opus = la sesión principal, que arma, revisa
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
| 6-nov | **Comentarios:** se guardan el texto y el @ de quien comenta; nunca el nombre, el id ni la foto (regla 3.6) | Andrés |
| 6-nov | **Pauta por la API de Meta**, no por Zernio. Solo lectura | Andrés: "se va a manejar directamente desde la API de Meta" |
| 6-nov | **El tablero es para ver:** "Editar borrador" (T15) apagado; se prende con `EDITAR_BORRADORES=1` | Andrés: "no es como para editar cosas por ahora" |
| 6-nov | **Se actualiza al entrar:** cada vez que se abre el tablero pide una lectura nueva (solo GET) | Andrés: "que cada vez que yo entre consulte se actualice" |
| 6-nov | Leads de BTWash: **todavía no** (no se toca su Supabase). No hay fase 4 | Andrés |

## Decisiones por revisar (sesión del servidor, noche del 6-nov)

Tomadas sin preguntar, eligiendo lo más seguro y reversible (`docs/handoff-servidor.md`). Andrés las revisa.

| # | Decisión | Por qué | Cómo deshacerla |
|---|---|---|---|
| 1 | ~~Sin push ni PR~~ **Resuelto el 6-nov:** `gh` quedó con sesión de `Tupap1` (login por código desde el celular), push de `fase-1`, `main` creada desde el primer commit y PR #1 abierto sin fusionar | Andrés lo autorizó desde Remote Control | `gh auth logout` (el token queda en `~/.config/gh/hosts.yml`, en texto plano) |
| 2 | Node 24 instalado en `~/.local/node24` (solo para el usuario, verificado con SHA256 de nodejs.org) | El sistema tiene Node 20 y el proyecto pide >= 24. No se tocó el Node del sistema | `rm -rf ~/.local/node24` |
| 3 | La base de **pruebas** corre con `synchronous_commit=off` | En WSL2 cada commit tarda ~28 ms y las pruebas del recolector pasaban de 5 s. Solo afecta a `btw_tablero_prueba*` | Quitar la línea en `pruebas/preparar-bd.ts` |
| 4 | `PROXY_RED=proxy-net` | Es la red de `nginx-proxy` y `cloudflare-tunnel` (`docker inspect`, sin cambiarlos) | Cambiar en `.env.produccion` |
| 5 | Los archivos de `~/btw-respaldos` se movieron a `respaldos/` (ignorado por git); los tar se extrajeron en `datos/btw-videos/` (ignorado) y `BTW_VIDEOS_DIR` apunta ahí | Lo pidió Andrés | — |
| 6 | La base de **desarrollo** del servidor (`127.0.0.1:5434`) se llenó con `btw_tablero.dump` | Para probar las pantallas con datos reales | `docker compose down -v` del compose de desarrollo |
| 7 | `.env.produccion` creado con secretos nuevos al azar (nunca impresos) y las 4 llaves de `respaldos/llaves-api.env` | Paso 0 del traspaso | Borrar el archivo y regenerar |
| 8 | **T08b sin relleno:** el historial de Zernio es acumulado, pero solo existe desde el 5-nov y sus puntos no traen la hora | Guardarlos sería inventar cuándo valía la cifra | Reabrir si Zernio agrega la hora (`docs/specs/T08b.md`) |
| 9 | Las imágenes se construyen desde un worktree limpio del último commit y producción se levanta desde el repo con `--no-build` | Que el trabajo a medias de los subagentes nunca entre a producción, y que `RESPALDO_HOST_DIR` quede en el repo | Con el árbol limpio, `docker compose ... up -d --build` desde el repo da lo mismo |
| 10 | Healthcheck de la base por TCP (`pg_isready -h 127.0.0.1`) en los dos compose | En el primer arranque `migrar` fallaba (el servidor temporal de inicialización solo escucha por socket) | — |
| 11 | Alias fijo `btw-insights-app` de la app en `proxy-net`; NPM apunta a `http://btw-insights-app:3000` | Un nombre que no depende del nombre del contenedor | Quitar el alias del compose |
| 12 | Producción arrancó del dump del 6-nov (no de `importar`), como pide el traspaso; luego se corrió `importar` una vez para las ideas y los guiones (idempotente, no pisa lo editado) | El dump trae lo leído hasta el 6-nov 00:23 | Restaurar el respaldo de antes (`respaldos/produccion/`) |
| 13 | **Facebook cuenta para "día sin video"** (T19) | La regla es por red; sale mucho aviso porque Facebook casi nunca está programado. Se plegó en `/hoy` como "Avisos de calendario" | Si Facebook no se programa a propósito, quitarlo de `alertasNuevasDeCola` |
| 14 | Ideas con formato que no está en el enum (p. ej. "Mito") quedan como `otro` y el formato original va al final del título | `idea` no tiene columna para el texto original | Una columna nueva si hace falta |
| 15 | El CSV de exportación lleva las fechas en ISO UTC (`Z`) | Es lo estándar; quien lo lea lo pasa a Bogotá | Cambiar `metricas.ts` |
| 16 | En el celular la barra muestra Hoy, Videos, Cola y "Más" (el resto y Salir en `/mas`) | Con 8 pantallas no caben | `src/componentes/enlaces.ts` |
| 17 | `editarBorrador` manda `scheduledFor` en UTC y sin `timezone` (documentación de Zernio: `PUT /v1/posts/{id}`) | No tocar más campos de los necesarios | Confirmar en el primer uso real (punto 8 de "Para Andrés") |
| 18 | **Incidente corregido:** al importar en producción (01:50) entraron 19 lecturas CSV de Meta repetidas (la hora del archivo perdió los milisegundos en el tar). Se arregló el código (hora en segundos enteros y tolerancia de 2 s) y se borraron esas 19 filas, verificadas como copias exactas, en producción y en desarrollo | "No se duplican cifras". Había respaldo de justo antes (`respaldos/produccion/btw-insights-20261106-014942.dump`) | Restaurar ese respaldo |
| 19 | **Al entrar** (T25): no se lanza otra lectura si la última empezó hace menos de 2 min; Meta relee lo de menos de 30 días con lectura de 10 min o más | Datos frescos sin una lectura por cada pestaña o vuelta | Constantes en `recolector/al-entrar.ts` y `plan.ts` |
| 20 | Cada relectura de Meta se guarda como lectura nueva aunque las cifras no cambien | La cifra de Meta vale "cuando se leyó": así el "dato de hace X" es real. Como mucho una por publicación cada 10 min | Saltar las lecturas idénticas en `guardar.ts` |
| 21 | La lectura al entrar usa el origen `boton` (no uno nuevo) | Es una lectura pedida desde el tablero; evita una migración del enum | Agregar `entrada` a `origen_corrida` |
| 22 | Comentarios: como mucho 30 hilos por corrida; un hilo se relee si cambió su conteo, quedó incompleto o pasaron 24 h. Solo cuentan los de primer nivel de otras personas | Zernio cachea el inbox 10 min y pide no sondearlo | `recolector/comentarios.ts` |
| 23 | T24 solo apaga la escritura en Zernio. Leads, notas del reel, "Asignar" y "Pasar a reel" siguen activos (escriben solo en la base del tablero; los leads no tienen otra fuente) | Lo mínimo para "solo ver" sin perder datos manuales | Ocultarlos igual que "Editar" |

## Para Andrés al levantarse

El tablero ya corre en Docker en este servidor (proyecto `btw-insights`: `db`, `app`, `cron` cada hora y `respaldo`
diario a las 3:00), con los datos del dump del 6-nov y una recolección real hecha. Falta lo que necesita tu inicio
de sesión:

0. **Urgente, IA sin etiqueta:** la primera recolección con las alertas nuevas encontró que los borradores de
   Zernio de los reels **11 (sale el 8-nov), 16, 17, 18, 20 y 21** (TikTok e Instagram) **no están marcados como
   hechos con IA**, aunque esos reels usan IA según el seguimiento. Lo comprobé con un GET a Zernio el 6-nov a las
   2:00: `isAiGenerated` y `video_made_with_ai` vienen en `false` (el 5-nov venían en `true`). No lo cambié: es una
   escritura en Zernio. Márcalos en Zernio antes de programarlos; la alerta se cierra sola en la siguiente lectura.
1. ~~Empujar y abrir el PR~~: hecho el 6-nov, https://github.com/Tupap1/btwInsights/pull/1 (no lo fusiones hasta revisarlo).
2. **Túnel de Cloudflare** (se puede desde el celular: Zero Trust → Networks → Tunnels → el túnel de este servidor →
   *Public hostnames* → *Add*): subdominio `insights`, dominio `btw-one.com`, servicio **HTTP** y URL
   **`btw-insights-app:3000`**. El túnel se maneja desde el panel (corre con token) y `cloudflared` está en
   `proxy-net`, así que llega directo a la app; Cloudflare crea el DNS solo.
3. *(Opcional)* Si prefieres que pase por Nginx Proxy Manager como tus otros dominios (todos apuntan a
   `http://nginx-proxy:80`): en NPM (`http://127.0.0.1:81` en el servidor) *Add Proxy Host* `insights.btw-one.com` →
   `http` `btw-insights-app` `3000`, con *Block Common Exploits* y *Websockets*, y en el túnel el servicio
   `nginx-proxy:80` en vez del de arriba.
4. **Probar:** `https://insights.btw-one.com/api/salud` debe dar `{"ok":true,"base":"ok"}` y cualquier otra página
   debe mandarte a `/entrar`.
5. **Registrar tu llave de acceso:** abre en el celular el enlace de invitación que dejé en la terminal de esta
   sesión (vale 24 h y un solo uso; no está en git). Si se venció o se perdió, crea otro:
   `docker compose --env-file .env.produccion -f docker-compose.prod.yml run --rm migrar node --conditions=react-server --import tsx scripts/invitar.ts "Andrés"`.
   La llave solo sirve en `insights.btw-one.com` (no por IP ni por localhost).
6. **`seguimiento.csv`** (en btw-videos): las filas del 13 y el 14 tienen una celda con coma sin comillas; ponla
   entre comillas y vuelve a importar.
7. **Asignar a mano** los 2 posts del 28-oct en "Sin asignar" (deben ser del 04-G4).
8. ~~Primer uso real de "Editar"~~: apagado (T24, el tablero es para ver). Si un día lo quieres, `EDITAR_BORRADORES=1`
   en `.env.produccion` y reinicia la app; pruébalo primero con un borrador que no importe.
9. **Pauta de Meta (T23):** el token del servidor no tiene `ads_read`. Genera uno con `ads_read` (mejor de un usuario
   del sistema del Business Manager, no vence), ponlo en `.env.produccion` y `.env.local` como `META_ADS_TOKEN` junto
   con `META_AD_ACCOUNT_ID=act_…`, y avísame. Nunca en el chat.
10. **Tarea de las 8:00** (en tu PC): sigue `docs/tarea-8am.md`. El secreto es `RECOLECTOR_SECRETO` de
    `.env.produccion` en el servidor: cópialo a una variable de entorno del PC, nunca al chat ni a un archivo del repo.
11. **Revisa "Decisiones por revisar"** (arriba): todas se pueden deshacer.

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

## Tareas — Fase 2

Regla de toda la fase: ninguna escritura real en Zernio ni en Meta durante la noche (todo con `fetch` simulado).

| ID | Tarea | Quién | Estado | Archivos |
|---|---|---|---|---|
| — | Migración `0002`: `publicacion.marca_ia` e índice único de `idea.fuente` | Opus | ✅ | `esquema.ts`, `migraciones/0002_*` |
| T15 | Editar borradores de Zernio (texto y fecha) desde `/cola`: un solo método de escritura con `isDraft: true` fijo, revisar → confirmar | Sonnet | ✅ (sin uso real todavía) | `fuentes/{http,zernio}.ts`, `borradores/*`, `cola/*`, `editar-borrador.tsx` |
| T16 | Banco de ideas y guiones: importación idempotente, `/ideas` y "Pasar a reel" | Sonnet | ✅ (14 ideas y 15 guiones en desarrollo) | `importar/{ideas,guiones,ideas-a-la-base}*`, `ideas/*`, `consultas/ideas*` |
| T17 | Leads: registro manual en `/leads`, por semana y por canal, tarjeta de `/hoy` | Sonnet | ✅ | `leads/*`, `consultas/leads*`, `(tablero)/leads/` |
| T18 | Cuentas: `/cuentas` y "Seguidores nuevos" de `/hoy` desde la misma consulta | Sonnet | ✅ | `consultas/cuentas*`, `(tablero)/cuentas/`, `grafica-cuentas.tsx` |
| T19 | Alertas completas: lectura atrasada, dobles, días sin video, token de Meta, IA sin etiqueta | Sonnet | ✅ | `recolector/alertas*`, `recolectar.ts`, `normalizar/zernio.ts`, `guardar.ts` |
| T20 | `/aprendizajes`: medianas a 48 h por gancho, formato, voz y variable; "pocos datos" con n < 3 | Sonnet | ✅ | `consultas/aprendizajes*`, `(tablero)/aprendizajes/` |
| T21 | `GET /api/exportar/metricas.csv` con secreto y `docs/tarea-8am.md` | Sonnet | ✅ (la tarea de las 8:00 no se cambió: está en tu PC) | `exportar/*`, `api/exportar/`, `docs/tarea-8am.md` |
| — | Integración: navegación con "Más", alertas de calendario plegadas en `/hoy`, capturas | Opus | ✅ | `navegacion.tsx`, `enlaces.ts`, `(tablero)/mas/`, `hoy` |

## Fase 3

| ID | Tarea | Quién | Estado | Archivos |
|---|---|---|---|---|
| — | Lecturas GET del inbox de Zernio y fixtures reales anonimizados | Opus | ✅ | `fuentes/zernio.ts`, `scripts/grabar-fixtures-fase3.ts`, `pruebas/fixtures/api/zernio-inbox-*` |
| T22 | Comentarios de Instagram y TikTok: migración 0003, bloque del recolector, `/comentarios`, sección en el detalle y tarjeta en `/hoy` | Sonnet + Opus | ✅ | `normalizar/comentarios*`, `recolector/comentarios*`, `consultas/comentarios*`, `(tablero)/comentarios/` |
| T23 | Pauta de Meta Ads por la API de Meta, solo lectura | — | ⛔ falta un token con `ads_read` y la cuenta publicitaria (`docs/specs/T23.md`) | — |
| T24 | El tablero es solo para ver: "Editar borrador" apagado | Opus | ✅ | `borradores/activa*`, `(tablero)/cola/*`, `config.ts` |
| T25 | Actualizar al entrar: lectura nueva al abrir el tablero y al volver a la pestaña | Opus | ✅ | `recolector/{plan,al-entrar}*`, `api/actualizar/`, `actualizar-al-entrar*` |

- **Copia de los videos en R2:** descartada (5-nov: los videos no se guardan en el tablero).
- **Leads de BTWash:** "todavía no" (Andrés, 6-nov). Su Supabase no se toca.
- **Pauta por Zernio:** se armó y se quitó el mismo día (Andrés prefiere la API de Meta).

## Investigación de servidores (5-nov; se eligió el servidor propio)

Gratis y siempre prendido solo sirve Oracle Always Free (A1: 2 OCPU y 12 GB), con riesgos: recupera la VM si está
ociosa, a veces no hay capacidad, pide tarjeta y cambia el plan sin aviso. Descartados: Vercel Hobby (uso comercial
prohibido), Render Free (se duerme y el Postgres expira a los 30 días), Fly.io (sin plan gratis), Google e2-micro
(1 GB de RAM), AWS y Azure (solo créditos o 12 meses) y Cloudflare Workers Free (10 ms de CPU).
