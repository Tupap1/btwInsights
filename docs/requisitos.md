# Tablero de contenido BTW: requisitos (v3, 6-nov-2026)

Lo pidió Andrés: un tablero que centralice las métricas de TikTok, Instagram y Facebook, el desempeño de cada video y
los próximos videos.

Decisiones del 6-nov:
- **Con base de datos** (Postgres), no solo CSV.
- **Base central de los videos:** el catálogo y los archivos en un almacenamiento durable.
- **En el PC de Andrés, sin Supabase** (v3: no le quedan proyectos gratis de Supabase). Debe verse desde el celular.
  Se diseña para poder pasar a la nube después solo con cambiar variables de entorno.

Este repo (`C:\Proyectos\btw-tablero`) es solo el tablero. Los reels se siguen produciendo en
`C:\Proyectos\btw-videos` (Remotion), que tiene los scripts y los datos actuales.

Antes de escribir código, lee en `C:\Proyectos\btw-videos`:
- `HANDOFF.md`;
- `scripts/metricas.mjs`, `scripts/zernio-borradores.mjs`, `scripts/meta-borradores.mjs` y `scripts/texto-red.mjs`;
- `publicar/calendario-zernio.json`, `publicar/zernio-borradores.csv`, `publicar/seguimiento.csv` y un
  `publicar/metricas/AAAA-MM-DD.csv`;
- `.claude/skills/btw-reels/guiones.md`.

---

## 1. Para qué sirve

1. **Ver en un solo lugar cómo va cada video** en las tres redes: crecimiento por horas, retención y conversación
   (comentarios, guardados, compartidos y leads), no solo vistas.
2. **Decidir qué hacer después:** qué gancho, formato o voz funciona, cuál repetir mejorado y cuál cortar.
3. **Saber qué sale y en qué estado va** en cada red: idea, guion, producido, borrador, programado, publicado o
   fallido. La cola de Zernio se lee de su API.
4. **Tener un catálogo central de los videos**, con su archivo guardado de forma durable y sus metadatos, que también
   usen los scripts de `btw-videos`.

Usuario: Andrés, una sola persona. Las sesiones de Claude leen y escriben los mismos datos por la API o la base.

## 2. Lo que ya existe y se reutiliza

| Pieza | Qué hace | Dónde (en `btw-videos`) |
|---|---|---|
| Lector de métricas | TikTok por Zernio (`GET /v1/analytics`). Facebook e Instagram por la Graph API de Meta, al minuto. De Zernio solo agrega lo que Meta no da (% que se salta en 3 s, curva de retención). Escribe CSV | `scripts/metricas.mjs` |
| Monitoreo diario | Tarea programada de Claude `btw-metricas-diarias` a las 8:00: corre el lector, escribe un resumen y llena las cifras de 48 h | `C:\Users\Andres\.claude\scheduled-tasks\btw-metricas-diarias\SKILL.md` |
| Cronograma | 1 video por día y red a las 19:30 (Bogotá); archivo por red e IA | `publicar/calendario-zernio.json` |
| Borradores | TikTok e Instagram en Zernio (`isDraft: true`). Facebook por Meta (`video_state=DRAFT`); falta el permiso `pages_manage_posts` | `scripts/zernio-borradores.mjs`, `scripts/meta-borradores.mjs`, `publicar/zernio-borradores.csv` |
| Seguimiento manual | Una fila por reel: gancho, voz, formato, cifras de 48 h y notas | `publicar/seguimiento.csv` (25 columnas) |
| Videos listos | Carpeta por video con el mp4 y `texto.txt` (texto por red) | `publicar/AAAA-MM-DD_dia_ID_slug/` |
| Grabaciones de la app | La app real de BTWash en modo de prueba, en celular | `public/app/grabaciones/` y `scripts/app/grabar.mjs` |
| Guiones e ideas | Puntuados de 12 | `guiones/` y `guiones/ideas-*.md` |

Cuentas:
- TikTok `btw.inc` e Instagram `btwone.co`, conectadas en Zernio. Son las 2 cuentas gratis de su plan.
- Facebook es la Página `BTW Inc` (id 1412423015288087), por la app de Meta `btwoneinsights`.
- **La cola de Zernio sí tiene API.** El 6-nov, `GET /v1/posts?status=draft` devolvió 20 borradores (10 de TikTok y
  10 de Instagram, con `tags: ["reel-NN"]` y `scheduledFor`); `scheduled`, `published` y `failed` dieron 0.

## 3. Reglas que no se rompen

1. **Llaves:**
   - Solo el servidor las usa.
   - Viven en `.env.local` del PC (fuera de git) o, si un día se pasa a la nube, en los secretos del despliegue. Nunca
     en el repo, el navegador, los registros, los errores ni en URLs que se muestren.
   - `.env.local` solo en desarrollo y fuera de git.
2. **Acceso solo para Andrés:**
   - Desde fuera del PC, la entrada pasa por Cloudflare Access, que pide un código por correo (solo el de Andrés).
   - La app verifica el JWT de Access (`Cf-Access-Jwt-Assertion`) en cada petición. Sin él, solo responde a
     `localhost`.
   - Sin registro abierto. El recolector se protege con un secreto.
3. **Nada se publica solo:** programar o publicar requiere un clic de Andrés con confirmación de qué, dónde y cuándo.
   Sin reglas automáticas que publiquen.
4. **No se inventan cifras.** Cada número dice su fuente (Meta, Zernio o manual) y su antigüedad. Si falta un dato, se
   muestra vacío.
5. **Cada red mide "vistas" a su manera.** Se muestra cada red aparte. Cuando se suma Instagram + Facebook (como la
   app de Instagram), va rotulado "IG + FB".
6. **Datos personales:** no se guardan datos de clientes de BTWash ni de quien comenta, salvo lo que Andrés pida
   (fase 3). El 6-nov Andrés pidió guardar el texto de cada comentario y el @ de quien comenta; el nombre, el id y la
   foto de esa persona no se guardan (T22).
7. **El Supabase de producción de BTWash no se toca.** El tablero tiene su propia base en el PC. Leer leads de
   BTWash es de la fase 3, solo lectura y con aprobación explícita.
8. **Español; America/Bogota; pesos colombianos con punto de miles.**

## 4. Arquitectura (v3: en el PC de Andrés)

| Capa | Decisión | Notas |
|---|---|---|
| Base de datos | **PostgreSQL en el PC**, en Docker (`postgres:16`) o con el instalador de Windows. Conexión por `DATABASE_URL` | Andrés ya usa Docker (Base de Datos 2). Es el mismo motor de la nube, así que pasar a Neon u otro Postgres es cambiar `DATABASE_URL`. Volumen con nombre para que los datos sobrevivan al contenedor |
| App web | Next.js (App Router), Tailwind, shadcn/ui y Recharts. Corre en producción (`next build` + `next start`) como servicio que arranca con Windows (pm2 con pm2-windows-startup, o NSSM) | Es el mismo stack de BTWash |
| Acceso desde el celular | **Cloudflare Tunnel** (`cloudflared` como servicio de Windows) más **Cloudflare Access** con código por correo, solo para Andrés | Plan gratis hasta 50 usuarios. Cloudflare pide un medio de pago aunque no cobre. Hace falta un dominio en Cloudflare (por ejemplo `tablero.btw-one.com` si el DNS de `btw-one.com` pasa a Cloudflare). Sin puertos abiertos en el router |
| Alternativa de acceso | Tailscale, una red privada entre el PC y el celular sin exponer nada | Su plan gratis es para uso **no comercial** según una fuente de 2026. BTW es un negocio, así que va como alternativa y no como primera opción |
| Recolector | Comando `npm run recolectar` con el **Programador de tareas de Windows**: cada 6 h, al iniciar sesión y al despertar el equipo, para ponerse al día. Botón "Actualizar ahora" en la app | Solo corre con el PC prendido. Si estuvo apagado, recupera lo que pueda: las APIs dan acumulados, y la evolución diaria se reconstruye con `GET /v1/analytics/post-timeline` de Zernio |
| Archivos de video | **Disco del PC** en una carpeta del tablero (por ejemplo `D:\btw-archivo\videos\<reel>\`), con `sha256`, y **copia automática a Google Drive personal** de Andrés (Drive para escritorio). No usar el Drive de la universidad, que se pierde al graduarse | Más adelante, Cloudflare R2 para tener una copia fuera del PC y enlaces directos (10 GB gratis, unos USD 0,015 por GB al mes) |
| Respaldo de la base | `pg_dump` diario a la carpeta respaldada en Drive. Se guardan los últimos 30 | Probar la restauración una vez |

**Riesgos de tenerlo en el PC y cómo se cubren:**
- **PC apagado o sin internet:** no hay recolección ni acceso. El tablero muestra "última lectura hace X h" y alerta
  si pasan más de 24 h. Windows no se suspende cuando está conectado a la corriente.
- **Un disco dañado:** respaldo diario en Drive personal.
- **Exposición:** nada abierto en el router. Todo entra por el túnel con Access, y la app valida el JWT.

**Camino a la nube (si un día hace falta), sin reescribir:**
- La app pasa a Vercel.
- La base pasa a Neon Postgres, cuyo plan gratis tiene unos 0,5-1 GB por proyecto según fuentes de 2026 (verificar).
- El recolector pasa a GitHub Actions.
- Con todo por variables de entorno, el código es el mismo.

**Volumen estimado:** 1 reel por día de unos 20-35 MB, más versiones por red, da unos 1-2 GB al mes de videos
finales. Los finales se guardan siempre; las versiones intermedias, 90 días.

### 4.1 Decisión de Andrés (6-nov) y reglas de portabilidad

**Local ahora, que se pueda pasar a Neon y Vercel.** Para que el cambio sea solo de configuración:

1. **Base de datos:**
   - Solo Postgres estándar (16), nada exclusivo de la máquina local. Las extensiones, solo si Neon las soporta
     (verificar en su lista).
   - Conexión por `DATABASE_URL`, con un controlador que sirva en los dos lados (por ejemplo, Drizzle con `postgres`
     o `pg` en local y el controlador serverless de Neon en Vercel, elegido por variable).
   - Migraciones versionadas que corran igual en los dos.
2. **Archivos de video detrás de una interfaz** (`guardar`, `leer`, `url`, `borrar`):
   - Hoy, adaptador de disco local (`ARCHIVO_DIR`).
   - En Vercel, adaptador de Cloudflare R2, porque allá no hay disco persistente.
   - El resto del código no sabe cuál se usa.
3. **Acceso detrás de una interfaz:**
   - Hoy, el JWT de Cloudflare Access, o `localhost`.
   - En Vercel, Cloudflare Access delante del dominio de Vercel, o un inicio de sesión propio (Auth.js con correo
     permitido).
   - Se elige por variable.
4. **El recolector no vive dentro de la app:**
   - Es un módulo con dos entradas: un comando (`npm run recolectar`) y una ruta HTTP protegida con
     `RECOLECTOR_SECRETO`.
   - Cada corrida termina en menos de 60 s, procesando por lotes si hace falta, porque las funciones de Vercel tienen
     límite de tiempo.
   - Hoy lo dispara el Programador de tareas; en la nube, GitHub Actions o Vercel Cron.
5. **Sin estado en el proceso:**
   - Nada de programadores (`setInterval`, colas en memoria) dentro del servidor de Next.js.
   - Nada de escribir en el disco fuera del adaptador de archivos.
   - Nada de rutas de Windows dentro del código. Las rutas salen de variables de entorno.
6. **Variables de entorno:** todo se configura por variables, documentadas en `.env.example`. Hay un archivo de
   ejemplo para la nube, `docs/nube.md`, con los pasos de la migración.
7. **Prueba de portabilidad (antes de cerrar la fase 1):** correr la app con `next build` + `next start`, apuntando a
   una base Postgres vacía y nueva (no la de uso diario), con las migraciones desde cero y la importación. Debe quedar
   igual.
## 5. Fuentes de datos

| Fuente | Qué trae | Frescura |
|---|---|---|
| Meta Graph API v25 (Instagram) | `/{ig}/media` (Reels: id, caption, timestamp, permalink, like_count, comments_count) e insights: views, reach, likes, comments, shares, saved, total_interactions, ig_reels_avg_watch_time, ig_reels_video_view_total_time | al minuto |
| Meta (Facebook) | `/{page}/video_reels` y `video_insights`: blue_reels_play_count, fb_reels_total_plays, post_video_avg_time_watched (ms), post_video_view_time, total_video_complete_views, post_video_social_actions, post_video_likes_by_reaction_type | al minuto |
| Meta (cuentas) | `/{ig}?fields=followers_count,media_count` y `/{page}?fields=followers_count,fan_count` | al minuto |
| Zernio: métricas de TikTok | `GET /v1/analytics`: views, likes, comments, shares, saves, igReelsAvgWatchTime (ms), completionRate, retentionCurve, impressionSources, audienceTypes, audienceCountries, follows, profileViews, videoDurationSeconds. En Instagram suma `reelsSkipRate` | sincroniza cada varias horas (`overview.dataStaleness`, `lastUpdated`) |
| Zernio: historial | `GET /v1/analytics/post-timeline?postId=` (evolución diaria por red), `GET /v1/analytics/delta`, `GET /v1/accounts/follower-stats` | idem |
| Zernio: cola | `GET /v1/posts?status=draft\|pending_approval\|scheduled\|publishing\|published\|partial\|failed\|cancelled`, `GET /v1/posts/{id}` y `PUT /v1/posts/{id}` (programar con `isDraft:false` + `scheduledFor`, fase 2) | al momento |
| Archivos de `btw-videos` | Importación inicial: cronograma, borradores, seguimiento, historial y carpetas de `publicar/` | una vez y luego por API |
| Manual | Leads, notas y aprendizajes | — |

Límites:
- Zernio gratis: 60 solicitudes por minuto.
- Meta: una métrica por llamada (una que no exista no tumba las demás), con reintentos ante el error 613 o 4.

## 6. Modelo de datos (Postgres)

- **reel**: es el catálogo central.
  - id ("17"), slug, gancho;
  - formato (la cuenta, diálogo, prueba real, Plata en 3D, pantalla dividida, otro);
  - voz (Fernando, Andrés, Andrés con Voice Changer, sin voz);
  - etiqueta_ia, duracion_s, puntaje_guion, variables_probadas, guion (texto o enlace), notas;
  - estado (idea, guion, producción, listo, archivado);
  - creado_en.
- **archivo**:
  - reel_id, tipo (final, final_tiktok, final_meta, portada, grabacion_app, guion_voz);
  - ruta (relativa a la carpeta del archivo), bytes, sha256, duracion_s, ancho, alto, respaldado_en, creado_en.
- **publicacion**:
  - reel_id, red, cuenta;
  - post_id_plataforma, zernio_post_id, enlace, texto;
  - programado_para, publicado_en;
  - estado (borrador, pendiente_aprobacion, programado, publicando, publicado, parcial, fallido, cancelado, borrado);
  - origen (zernio, meta, manual).
- **lectura**: una por publicación y momento.
  - publicacion_id, leido_en, horas_desde_publicacion;
  - vistas, alcance, me_gusta, comentarios, compartidos, guardados, seguidores_ganados, visitas_perfil;
  - tiempo_promedio_s, tiempo_total_s, pct_completo, pct_salta_3s, ret_1s, ret_3s, ret_5s, ret_10s;
  - pct_para_ti, pct_no_seguidores, pais_principal;
  - fuente, dato_actualizado_en.
- **curva_retencion**: publicacion_id, leido_en, puntos (jsonb: segundo → %).
- **cuenta_lectura**: red, leido_en, seguidores, publicaciones.
- **idea**: id, titulo, gancho, formato, funcion_btwash, verificada_en_codigo, puntaje, estado, fuente.
- **lead**:
  - fecha, canal (calculadora, comentario, DM, WhatsApp directo);
  - reel_id (si se sabe), nota, resultado (prueba, venta, nada).
- **alerta**: tipo, mensaje, creada_en, resuelta_en.

La app usa un rol de base con permisos mínimos y el recolector el suyo. Las migraciones van versionadas en el repo
(Drizzle u otro ORM tipado).

## 7. Emparejar publicaciones con reels

1. **Por id guardado:** `zernio_post_id` o `post_id_plataforma`. Los borradores de Zernio ya traen `tags: ["reel-NN"]`.
2. **Si no hay id,** por la fecha (±1 día del cronograma) y por el inicio del texto, normalizado (sin tildes ni emojis,
   primeras 40 letras) y comparado con el `texto.txt` del reel.
3. **Si sigue sin emparejar,** queda en "Sin asignar" para que Andrés lo asigne a mano. Se guarda.

Criterio: los 28 posts de hoy (9 de TikTok, 8 de Instagram y 11 de Facebook) quedan emparejados o en "Sin asignar",
sin duplicar.

## 8. Recolección (en el PC)

- **Cuándo:**
  - en las primeras 72 h de cada publicación, cada 6 h;
  - después, una vez al día hasta el día 30;
  - después, una vez por semana.
  - Las cuentas y la cola de Zernio, en cada corrida.
- **Errores:** si una fuente falla, se guarda lo que llegó, se crea una alerta y no se borra nada.
- **Botón "Actualizar ahora"** en el tablero, que llama la misma función.
- **Si el PC estuvo apagado,** al prender recupera lo posible y marca los huecos.
- **El lector de `btw-videos`:** cuando el recolector funcione, la tarea de las 8:00 lee del tablero (API o base) y
  deja de escribir CSV propios. Se mantiene una exportación CSV para respaldo y para las sesiones.

## 9. Pantallas y criterios de aceptación

### 9.1 Hoy
- Tarjetas de la semana contra la anterior, por red:
  - vistas;
  - tiempo promedio como % de la duración;
  - % que pasa del segundo 3 (TikTok: `ret_3s`; Instagram: `100 − pct_salta_3s`);
  - guardados más compartidos;
  - seguidores nuevos;
  - leads.
- Qué sale hoy y mañana, con su estado en cada red y los avisos de `texto.txt` (por ejemplo, la etiqueta de IA).
  **Alerta si a un video de hoy le falta programar** (por ejemplo: "el 14 sigue en borrador y sale a las 19:30").
- Alertas abiertas y el mejor video de los últimos 7 días, con sus cifras.
- **Aceptación:** cada cifra muestra su fuente y su antigüedad. Carga en menos de 2 s.

### 9.2 Videos (catálogo y desempeño)
- Una fila por reel con su gancho, formato, voz y fecha. Por red: vistas, tiempo promedio, % completo y % que pasa
  del segundo 3. Columna "IG + FB".
- Cifras a 48 h y a 7 días, de la lectura más cercana.
- Filtros (formato, voz, red, fechas) y orden por cualquier columna.
- Colores contra la mediana de los últimos 10 de la misma red; el video atípico va marcado.
- **Aceptación:** con los datos del 6-nov, el 10 ("Montaste tu lavadero…") es el primero en Instagram y "¿Cuánto
  cuesta montar…", en TikTok.

### 9.3 Detalle de un video
- El gancho, el guion, el texto por red y los enlaces a cada publicación.
- El reproductor del archivo final, servido desde el disco por la app y solo con sesión válida.
- **Curva de crecimiento** (vistas por horas desde la publicación, una línea por red) junto a la mediana.
- **Curva de retención** (TikTok y Facebook si existe), comparada con la del mejor del mismo formato.
- Fuentes de tráfico, no seguidores y país (TikTok).
- Notas y aprendizajes que se editan ahí mismo.

### 9.4 Cola y calendario
- 14 días: día por red, con el estado real de Zernio (y de Meta para Facebook).
- **Avisos:**
  - dos videos el mismo día en la misma red;
  - día sin video;
  - IA sin etiqueta;
  - borrador que sale hoy sin programar;
  - publicación fallida.
- **Fase 2, acciones con confirmación:**
  - programar un borrador (`PUT /v1/posts/{id}` con `isDraft: false` y `scheduledFor`);
  - crear los que falten, subiendo el archivo desde la carpeta del archivo;
  - cambiar la fecha.

### 9.5 Catálogo de archivos
- Subir el final de un reel, que queda en la carpeta del archivo con su `sha256` y se registra en `archivo`. Se avisa
  si el respaldo en Drive no lo ha copiado en 24 h.
- Ver todos los archivos de un reel y descargarlos.
- Importar los finales que ya existen en `btw-videos/publicar/` con un script de una vez.

### 9.6 Ideas, cuentas y leads (fase 2)
- **Ideas:** el banco de ideas con puntaje, función verificada y estado, y el botón "Pasar a reel".
- **Cuentas:** seguidores por red en el tiempo.
- **Leads:** registro manual con atribución a un reel; leads por semana y por canal.

## 10. Fases

- **Fase 1:**
  - repo, Postgres en el PC con migraciones;
  - la app como servicio que arranca con Windows;
  - el recolector en el Programador de tareas;
  - importación de lo que existe;
  - pantallas Hoy, Videos, Detalle y Cola (solo lectura);
  - los finales copiados a la carpeta del archivo;
  - respaldo diario.
  - **Acceso desde el celular con Cloudflare Tunnel + Access, si Andrés ya tiene el dominio en Cloudflare.** Si no,
    queda para el final de la fase 1.
- **Fase 2:** acciones de la cola con confirmación, ideas, leads, alertas completas, pruebas A/B y la tarea de las
  8:00 leyendo del tablero.
- **Fase 3:**
  - comentarios desde el inbox de Zernio;
  - pauta (Meta Ads, solo lectura);
  - leads de BTWash (solo lectura, con aprobación);
  - copia de los videos en Cloudflare R2.
## 11. Requisitos no funcionales

- **Se ve bien en el celular** (Andrés lo revisa desde el teléfono).
- **TypeScript estricto**, sin `any`. Lint y pruebas antes de terminar.
- **Pruebas:**
  - unitarias para la normalización por red (milisegundos a segundos, reacciones de Facebook, curvas) y para el
    emparejamiento;
  - fixtures con los CSV reales;
  - nada contra las APIs reales en CI.
- **Seguridad:**
  - revisar que ningún secreto llegue al bundle (buscar el valor del token en `.next`);
  - la app solo responde a `localhost` o a peticiones con JWT válido de Cloudflare Access;
  - el recolector protegido con un secreto;
  - la base no se expone fuera del PC (Docker publicado solo en `127.0.0.1`).
- **Costos:** cero. Postgres, Next.js, pm2 y Drive personal; el túnel y Access de Cloudflare, en plan gratis. Solo el
  dominio, si no lo tiene. R2 es opcional.
- **Portabilidad:** todo por variables de entorno (`DATABASE_URL`, la carpeta del archivo, las llaves), para pasar a la
  nube sin reescribir.

## 12. Lo que debe decidir o hacer Andrés (preguntarlo al empezar)

1. **Base de datos:** ya se decidió local y migrable a Neon y Vercel (sección 4.1). Falta saber: ¿Postgres en Docker
   (recomendado) o el instalador de Windows? ¿Ya tiene un Postgres corriendo en el PC?
2. **Carpeta del archivo de videos:** en qué disco, y confirmar que Drive para escritorio de su cuenta **personal** la
   respalde.
3. **Acceso desde el celular:**
   - ¿El DNS de `btw-one.com` (u otro dominio) puede estar en Cloudflare para usar `tablero.<dominio>`?
   - Andrés crea la cuenta de Cloudflare y pone el medio de pago que pide Zero Trust. Claude no crea cuentas ni
     escribe contraseñas.
4. **El PC:** ¿se queda prendido? Si no, ¿a qué horas suele estarlo? (Define cuándo corre el recolector.)
5. **Fase 2:** ¿el tablero debe poder programar borradores o solo mostrarlos?
## 13. Terminado (fase 1)

- **Disponible:**
  - `http://localhost:<puerto>` abre el tablero después de reiniciar el PC, sin hacer nada a mano;
  - si ya hay dominio, `https://tablero.<dominio>` pide el código de Cloudflare Access y solo entra el correo de
    Andrés.
- **Pantallas:** Hoy, Videos, Detalle y Cola, con los datos reales importados y la cola de Zernio en vivo.
- **Recolector:** corre solo (Programador de tareas), agrega lecturas sin duplicar y crea alertas si algo falla o si
  pasan más de 24 h sin leer.
- **Datos completos:**
  - los 28 posts de hoy emparejados o en "Sin asignar";
  - los finales de `publicar/` en la carpeta del archivo, registrados y respaldados en Drive;
  - el `pg_dump` diario funcionando y una restauración probada.
- **Seguridad y calidad:** ningún secreto en el navegador ni en los registros; pruebas y lint pasan.
- **Documentación:** el README explica cómo correrlo, actualizarlo y respaldarlo.
