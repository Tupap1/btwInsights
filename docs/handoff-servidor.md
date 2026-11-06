# Traspaso: terminar la fase 1 en el servidor (6-nov-2026)

**Meta:** antes de que Andrés se levante, **todo el tablero** terminado y corriendo en Docker en este servidor:
- la fase 1 completa;
- la fase 2 completa;
- de la fase 3, lo que no necesita un permiso o una decisión de Andrés.

Un commit por tarea, todo empujado a `origin/fase-1` y un PR a `main` **sin fusionar**. Primero la fase 1 entera y
desplegada (T09 a T14); después la 2 y la 3, desplegando al cerrar cada tarea. Lo bloqueado y lo que necesite a
Andrés (iniciar sesión en un panel, registrar su llave de acceso) queda en una lista corta al final del `TRACKER.md`.

## Cómo trabajar

- **Lee primero:** `CLAUDE.md` (reglas), `TRACKER.md` (decisiones y estado), `docs/requisitos.md` (sección 3 y la
  que toque) y `docs/despliegue.md`.
- **SDD:** antes de cada tarea escribe su especificación corta en `docs/specs/<ID>.md`, con:
  - qué se hace;
  - los criterios de aceptación verificables;
  - los archivos que toca;
  - lo que queda fuera.
- **TDD:** primero la prueba que falla (rojo), luego el código hasta que pasa (verde) y luego el orden. Antes de
  cada commit, `npm run verificar` en verde; en lo que toque la app, también `npm run build`.
- **Commits:** uno por tarea terminada, y `git push origin fase-1` después de cada uno. Nunca `--force` ni fusionar a
  `main`.
- **Subagentes:**
  - a Sonnet, el código con lógica; a Haiku, los documentos y lo mecánico;
  - tú integras y revisas;
  - nunca dos agentes en los mismos archivos;
  - para las pruebas de base en paralelo, cada uno usa su propia `BD_PRUEBA_NOMBRE=btw_tablero_prueba_<id>`.
- **No preguntes:** si hay que decidir, toma la opción más segura y reversible y anótala en `TRACKER.md`, en
  "Decisiones por revisar".
- **Prohibido:**
  - publicar, programar o editar en Zernio o Meta (solo GET);
  - tocar el Supabase de BTWash;
  - imprimir llaves;
  - tocar contenedores, redes o volúmenes que no sean del tablero.

## Paso 0: el entorno

1. `git pull` (la última es la del 6-nov, "Traspaso a la sesión del servidor"), `npm ci`.
2. **Lo que no está en git** lo deja Andrés en `respaldos/` (git lo ignora):
   - `llaves-api.env`: `META_PAGE_TOKEN`, `META_PAGE_ID`, `IG_USER_ID` y `ZERNIO_API_KEY`;
   - `btw_tablero.dump`: la base con todo lo importado y leído hasta el 6-nov a las 00:23 (pg_dump `-Fc`);
   - `publicar-sin-videos.tar.gz`: `btw-videos/publicar/` sin videos ni imágenes, para `npm run importar`;
   - `guiones-md.tar.gz`: los `.md` de `btw-videos/guiones/` (guiones por reel e `ideas-*.md`), para T16.

   Si falta alguno, sigue con lo que no dependa de él y anótalo.
3. **`.env.local`** (desarrollo y pruebas en el servidor):
   - copia `respaldos/llaves-api.env`;
   - corre `npm run preparar-env`, que genera la contraseña de la base y el secreto sin mostrarlos;
   - corrige `BTW_VIDEOS_DIR` para que apunte a donde extraigas el tar;
   - `npm run db:subir`, `npm run db:migrar` y `npm run verificar`.
4. **`.env.produccion`** (para `docker-compose.prod.yml`; ver `docs/despliegue.md`):
   - las 4 llaves;
   - secretos nuevos generados al azar y nunca impresos;
   - `WEBAUTHN_RP_ID=insights.btw-one.com`, `WEBAUTHN_ORIGEN=https://insights.btw-one.com` y
     `WEBAUTHN_RP_NOMBRE=BTW Insights`;
   - `PROXY_RED`: la red de Docker de Nginx Proxy Manager. Encuéntrala con `docker ps` y `docker inspect` sobre el
     contenedor de NPM, sin modificarlo.

## Tareas, en orden

### T09: inicio de sesión con passkey (decidido por Andrés el 6-nov)
- **Librerías:** `@simplewebauthn/server@14` y `@simplewebauthn/browser@14`. Revisa su API en `node_modules` antes de
  escribir.
- **Tablas** (nueva migración):
  - `usuario`: id, nombre único, `id_webauthn` aleatorio único, activo, creado_en;
  - `credencial`: id = credentialID en base64url, usuario_id, clave_publica en base64url, contador (bigint),
    transportes (text[]), creada_en, usada_en;
  - `sesion`: hash sha256 como PK, usuario_id, creada_en, expira_en, usada_en;
  - `invitacion`: hash como PK, usuario_id, creada_en, expira_en, usada_en;
  - `desafio`: id aleatorio, reto, tipo (registro o entrada), usuario_id nulo, expira_en.

  **Nunca se guarda un token en claro.**
- **Invitar:** `npm run invitar -- "<nombre>"` (y lo mismo dentro de la imagen `herramientas`) crea el usuario si no
  existe y una invitación de un solo uso que vale 24 h. Imprime `${WEBAUTHN_ORIGEN}/registrar?t=<token>`. Ese
  enlace nunca va a git.
- **`/registrar?t=`:**
  - valida la invitación;
  - hace el registro con `residentKey: "required"`, `userVerification: "required"`, attestation "none" y
    `excludeCredentials`;
  - guarda la credencial, marca la invitación como usada y crea la sesión.
- **`/entrar`:**
  - un botón "Entrar con llave de acceso", con credenciales detectables (sin `allowCredentials`) y
    `userVerification: "required"`;
  - verifica la firma y el contador, y crea la sesión.
- **`Salir`:** borra la sesión.
- **Desafío:** una fila en `desafio` más una cookie httpOnly de 5 min con su id. Se consume una sola vez.
- **Sesión:**
  - token aleatorio de 32 bytes en la cookie `__Host-btw_sesion` (Secure, HttpOnly, SameSite=Lax, Path=/), válida
    30 días; en la base solo va su sha256;
  - `exigirSesion()` (en `src/servidor/acceso/sesion.ts`, que ya usan todas las pantallas) la valida en cada página,
    acción y ruta, y si no hay sesión redirige a `/entrar`;
  - en desarrollo (`NODE_ENV=development`) sigue entrando "local"; en producción, nunca.
- **`src/proxy.ts`:**
  - solo hace la revisión optimista: sin cookie, redirige a `/entrar`;
  - quedan fuera `/entrar`, `/registrar`, `/api/salud`, `/api/recolectar` (tiene su propio secreto) y los
    estáticos;
  - las redirecciones usan `WEBAUTHN_ORIGEN`, porque detrás de NPM el `Host` puede ser interno.
- **Cabeceras** en `next.config.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` y una `Permissions-Policy` mínima.
- **Pruebas:**
  - invitación de un solo uso y vencida;
  - desafío de un solo uso y vencido;
  - sesión vencida, y que en la base no quede el token en claro;
  - la verificación con respuestas de ejemplo de SimpleWebAuthn, o con `verify*` simulados.

### T10b: pulido en el celular (revisión de Opus a 375 px, 6-nov)
- **`/videos`:**
  - en el celular, tarjetas por reel con las cifras por red a la vista (hoy la tabla las esconde a la derecha);
  - por defecto, los publicados primero, por fecha de publicación descendente; los futuros sin datos van al final;
  - quitar el espacio vacío encima del encabezado de la tabla;
  - los selects de los filtros dicen "Todos";
  - los filtros se pliegan en el celular.
- **`/cola`:**
  - "Vie, 6 De Nov" pasa a "vie 6 de nov";
  - el aviso "día sin video" se ve en la celda: el Facebook del 7-nov está vacío y no avisa.
- **`/videos/[id]`:** revisar las gráficas a 375 px.
- **"Actualizar ahora":** probarlo una vez (solo hace GET a las APIs).
- **Capturas** a 375 y 1440 px en `docs/capturas/` (sin datos sensibles; son cifras de redes públicas).

### T08b: huecos de los domingos con el historial diario de Zernio
Primero graba un `post-timeline` de un post con varios días (amplía `scripts/grabar-fixtures.ts`), para saber si los
valores son acumulados o del día. Si no se puede saber con certeza, no lo implementes: anótalo y sigue.

### T12: roles de la base y respaldo fuera del contenedor
- Roles: dueño (migraciones), app (lee y escribe, sin DDL ni DELETE salvo `sesion`, `desafio` e `invitacion`) y
  lectura.
- El respaldo diario también se copia a una carpeta del host (`RESPALDO_HOST_DIR`). Andrés decide luego si esa
  carpeta va a Drive.
- Restauración probada en una base aparte.

### T13: portabilidad, secretos y documentación
- **Portabilidad:** una base nueva y vacía, con las migraciones desde cero, la importación (del tar) y luego
  `next build` + `next start`, debe quedar igual.
- **Secretos en el bundle:** el script `scripts/revisar-secretos.*` busca los **valores** de las llaves en `.next/` y
  en la imagen, sin imprimirlos.
- **Documentos:** README (correr, actualizar y respaldar), `docs/nube.md` (Neon, cambiando solo `DATABASE_URL`) y
  `.env.example` completo.

### T14: despliegue en este servidor
1. `docker compose -f docker-compose.prod.yml --env-file .env.produccion up -d --build`, unido a `PROXY_RED`.
2. **Datos:** restaura `btw_tablero.dump` en la base de producción. Las migraciones ya registradas no se repiten,
   porque el dump trae `drizzle.__drizzle_migrations`; después corre `migrar` para las nuevas (T09). Si el dump
   falla, `importar` con el tar.
3. Una recolección: el contenedor `cron` o `curl` interno con el secreto. `/api/salud` responde
   `{ ok: true, base: "ok" }` dentro de la red.
4. Revisa que `cron` corra cada hora y que `respaldo` deje su archivo.
5. Genera la invitación de Andrés (`invitar "Andrés"`) y deja el enlace **solo en la terminal**, no en git.

**No configures Nginx Proxy Manager ni el túnel:** necesitan el inicio de sesión de Andrés. Deja en `TRACKER.md` los
pasos exactos:
- el proxy host `insights.btw-one.com` → `<contenedor app>:3000`, con SSL;
- el hostname público del túnel, si aplica.

## Fase 2 (después de desplegar la fase 1)

Regla de toda la fase: **ninguna escritura real en Zernio ni en Meta durante la noche.** Lo que escriba en las APIs se
prueba con fetch simulado y el primer uso real lo hace Andrés con su clic.

### T15: ver y editar borradores de Zernio (decidido por Andrés el 5-nov)
- En `/cola`, cada borrador de TikTok o Instagram se puede editar: el texto y la fecha y hora (Bogotá).
- Se guarda con `PUT /v1/posts/{id}`, **siempre con `isDraft: true`**. Nunca se crea un post, nunca se programa, nunca
  se publica y nunca se cambia `isDraft`.
- Antes de enviar, una confirmación que muestra qué cambia, en qué red y para cuándo, con un botón "Guardar
  borrador".
- El cliente de Zernio gana un único método de escritura, `editarBorrador(id, { contenido?, programadoPara? })`, que
  arma el cuerpo con `isDraft: true` fijo. Prueba que ninguna combinación de entrada lo pueda quitar.
- Facebook no se edita: no hay permiso `pages_manage_posts`. Muéstralo como "solo en Meta Business Suite".

### T16: banco de ideas y guiones
- Importa `guiones/ideas-*.md` a `idea`: título, gancho, formato, función de BTWash, puntaje y estado.
- Importa a `reel.guion` el texto de `guiones/<id>-*.md` de cada reel, sin pisar lo que ya tenga.
- Pantalla `/ideas`: lista con filtros y puntaje, y el botón "Pasar a reel", que crea el reel en la base del tablero
  con estado "idea".
- Re-importar es idempotente.

### T17: leads
- Registro manual en `/leads`: fecha, canal (calculadora, comentario, DM o WhatsApp), reel (opcional), nota y
  resultado (prueba, venta o nada).
- Leads por semana y por canal.
- La tarjeta "Leads" de `/hoy` deja de ser "—".
- Sin datos personales: solo el canal y una nota libre que escribe Andrés.

### T18: cuentas
`/cuentas` muestra los seguidores por red en el tiempo, desde `cuenta_lectura`, cada punto con su fuente y su fecha.
"Seguidores nuevos" de `/hoy` sale de aquí.

### T19: alertas completas
Además de las que ya hay (borrador sin programar y fallida):
- más de 24 h sin leer;
- dos videos el mismo día en la misma red;
- día sin video en los próximos 7;
- token de Meta por vencer o sin permisos (`debug_token` no sirve sin poner el token en la URL; usa el error que
  devuelvan las llamadas);
- **IA sin etiqueta:** guarda la marca de IA de cada borrador de Zernio (`tiktokSettings.video_made_with_ai` o
  `platformSpecificData.isAiGenerated`) en una columna nueva de `publicacion`, y compárala con `reel.etiquetaIa`.

Cada alerta se resuelve sola cuando deja de cumplirse.

### T20: qué funciona (pruebas A/B)
- `/aprendizajes`: compara grupos de reels por gancho, formato, voz y variables probadas, usando la mediana a 48 h
  de cada métrica por red y cuántos videos hay en cada grupo.
- Con menos de 3 videos en un grupo, "pocos datos" en vez de conclusión. Sin inventar significancia.

### T21: datos para btw-videos
- `GET /api/exportar/metricas.csv`, protegida con `RECOLECTOR_SECRETO`: una fila por publicación con la última lectura
  y su fuente, para la tarea de las 8:00.
- Deja escrito en `docs/tarea-8am.md` cómo cambiar esa tarea (vive en el PC de Andrés,
  `C:\Users\Andres\.claude\scheduled-tasks\btw-metricas-diarias\SKILL.md`) para que lea del tablero. No la cambies
  tú: no está en este servidor.

## Fase 3: solo lo que no necesita a Andrés

- **Copia de videos en R2:** descartada. Andrés dijo el 5-nov que los videos no importan.
- **Bloqueados.** Déjalos en "Para Andrés", con lo que haría falta:
  - **Comentarios del inbox de Zernio:** la regla 3.6 dice que no se guardan datos de quien comenta salvo lo que
    Andrés pida. Él tiene que decir qué se guarda.
  - **Pauta de Meta Ads (solo lectura):** el token no tiene `ads_read` ni hay cuenta publicitaria configurada.
  - **Leads de BTWash desde Supabase:** la regla 3.7 exige su aprobación explícita.

### Al final
- PR `fase-1` → `main` con `gh pr create`: resumen, pruebas y lo pendiente. No lo fusiones.
- **En `TRACKER.md`:** estado al cierre, "Decisiones por revisar" y la sección "Para Andrés al levantarse":
  1. NPM y el túnel;
  2. abrir el enlace de invitación en el celular y registrar la llave de acceso;
  3. corregir las filas del 13 y el 14 en `btw-videos/publicar/seguimiento.csv` (celdas con coma sin comillas) y
     volver a importar.
