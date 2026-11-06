# btw-tablero (BTW Insights)

Tablero de contenido de BTW: métricas de TikTok, Instagram y Facebook por video, la cola de publicaciones y el
catálogo de reels.

Corre en Docker, en el servidor de BTW (Windows Server 2025 con WSL2). Se ve en `insights.btw-one.com`, detrás de
Nginx Proxy Manager. El inicio de sesión es con llave de acceso (passkey), por invitación.

Empieza por `docs/requisitos.md`.

## Desarrollo

Necesitas Node 24 y Docker (para la base de desarrollo).

```bash
npm ci
npm run preparar-env        # crea .env.local con contraseña y secreto al azar (no los muestra)
npm run db:subir            # Postgres en 127.0.0.1:5434
npm run db:migrar
npm run importar            # antes, pon la carpeta de btw-videos en BTW_VIDEOS_DIR (.env.local)
npm run dev                 # http://localhost:3000
npm run verificar           # tsc, eslint y pruebas
```

Las llaves de Meta y Zernio van en `.env.local`. Las variables están en `.env.example` (solo nombres).

En desarrollo entra el usuario `local`, sin llave. En producción nunca.

## Producción

Sigue `docs/despliegue.md`: construir la imagen, crear `.env.produccion`, levantar y ver los registros.

## Actualizar

1. `git pull`.
2. Respaldo a mano, por si acaso.
3. `build` y `up -d`. `migrar` corre antes que `app`.

Pasos exactos en `docs/despliegue.md`, sección 7.

## Respaldar y restaurar

- Respaldo diario a las 3:00 (hora de Bogotá). Se guardan los últimos 30, en el volumen `respaldos` y en la carpeta
  `RESPALDO_HOST_DIR` del servidor.
- `probar-restauracion.sh --respaldar-antes` restaura en una base aparte y compara los conteos. Conviene correrlo una
  vez al mes.
- Restaurar reemplaza todo el contenido de la base. Hazlo solo con el procedimiento de `docs/despliegue.md`, sección 6.

## Invitar a alguien

En desarrollo:

```bash
npm run invitar -- "Nombre"
```

En producción:

```bash
docker compose --env-file .env.produccion -f docker-compose.prod.yml run --rm migrar node --conditions=react-server --import tsx scripts/invitar.ts "Nombre"
```

El enlace vale 24 horas y se usa una sola vez. Nunca lo pegues en git ni en el chat.

## Comandos útiles

- `npm run recolectar`: lee Zernio y Meta, y guarda las cifras en la base (solo GET).
- `npm run grabar-fixtures`: guarda respuestas reales de las APIs en `pruebas/fixtures/api/`, sin llaves.
- `node scripts/revisar-secretos.mjs --env <archivo> [--dir .next] [--imagen btw-insights-app:local]`: busca los
  valores de las llaves en `.next/` y en la imagen. No imprime valores. Sale con código 1 si encuentra alguno.

## Reglas

- Las llaves solo se usan en el servidor. Nunca van al repo, al navegador ni a los registros.
- Nada se publica en Zernio ni en Meta sin un clic de Andrés con confirmación. En la fase 1 solo se lee (GET).
- Cada cifra dice su fuente (Meta, Zernio o manual) y su antigüedad.
- `null` significa que la fuente no dio el dato. Nunca es 0.
- El Supabase de BTWash no se toca.

## Documentos

- `docs/requisitos.md`: objetivos, arquitectura, fuentes de datos, pantallas, fases y reglas.
- `docs/despliegue.md`: construir, levantar, respaldos, roles y actualizaciones.
- `docs/nube.md`: cómo pasar a la nube (Neon), si algún día hace falta.
- `docs/tarea-8am.md`: cómo cambiar la tarea de las 8:00 para leer del tablero.
- `docs/handoff-servidor.md`: plan de la sesión que dejó el tablero en el servidor.
- `docs/specs/`: especificación de cada tarea, con sus criterios de aceptación.
- `docs/capturas/`: capturas de pantalla a 375 y 1440 px.
- `TRACKER.md`: estado, decisiones y pendientes.
