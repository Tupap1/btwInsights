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

## Pendiente de Andrés

1. **`seguimiento.csv` (en btw-videos):** las filas del 14 y del 13 tienen una celda con coma sin comillas (la de
   la etiqueta de IA). Ponerla entre comillas y volver a correr `npm run importar`.
2. **Nginx Proxy Manager:** ¿cómo se llama la red de Docker donde corre? El tablero se une a ella (`PROXY_RED`).
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
| T08b | Rellenar huecos (domingos) con el historial diario de Zernio | Sonnet | ⬜ | `src/servidor/recolector/historial*.ts` |
| T11 | Docker de producción: imagen `app` (326 MB, amd64 probada) y `herramientas`; Compose con base, migración, app, cron cada hora y respaldo diario | Sonnet | ✅ | `Dockerfile`, `docker-compose.prod.yml`, `docker/*`, `src/app/api/salud/`, `docs/despliegue.md` |
| T09 | Inicio de sesión propio, sesión en la base, `proxy.ts` y verificación en cada ruta | Opus | ⬜ (passkey decidida el 6-nov; diseño en `docs/handoff-servidor.md`) | `src/servidor/acceso/*`, `src/proxy.ts` |
| T10 | Pantallas: Hoy, Videos, Detalle, Cola de 14 días y Sin asignar (celular primero; cada cifra con su fuente y antigüedad) | Sonnet | ✅ (229 pruebas; pulido en T10b) | `src/app/(tablero)/*`, `src/componentes/*`, `src/servidor/consultas/*` |
| T12 | Roles de la base (dueño, app y lectura), copia del respaldo fuera del servidor y restauración probada | Opus | ⬜ | `scripts/roles.sql`, `docker/respaldo/*` |
| T13 | Prueba de portabilidad (base nueva), búsqueda de secretos en `.next`, README, `docs/nube.md`, `.env.example` | Haiku + Opus | ⬜ | `README.md`, `docs/*`, `.env.example`, `scripts/revisar-secretos.*` |
| T14 | Desplegar en el servidor de BTW: levantar el Compose entero, unirlo a Nginx Proxy Manager y abrir insights.btw-one.com | Opus | ⬜ (espera la pregunta 2) | — |

**Siguiente:** la sesión del servidor sigue con `docs/handoff-servidor.md`: fase 1 (T09, T10b, T08b, T12, T13 y T14), fase 2 (T15 a T21) y, de la fase 3, lo que no necesita a Andrés.

## Fase 2

- Ver y editar los borradores de Zernio (texto y fecha), siempre con `isDraft: true` y con confirmación.
- Ideas, leads, alertas completas y la tarea de las 8:00 de `btw-videos` leyendo del tablero.

## Investigación de servidores (5-nov; se eligió el servidor propio)

Gratis y siempre prendido solo sirve Oracle Always Free (A1: 2 OCPU y 12 GB), con riesgos: recupera la VM si está
ociosa, a veces no hay capacidad, pide tarjeta y cambia el plan sin aviso. Descartados: Vercel Hobby (uso comercial
prohibido), Render Free (se duerme y el Postgres expira a los 30 días), Fly.io (sin plan gratis), Google e2-micro
(1 GB de RAM), AWS y Azure (solo créditos o 12 meses) y Cloudflare Workers Free (10 ms de CPU).
