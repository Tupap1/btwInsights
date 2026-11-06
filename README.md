# btw-tablero

Tablero de contenido de BTW: métricas de TikTok, Instagram y Facebook por video, la cola de publicaciones (Zernio y
Meta) y el catálogo central de los videos. Corre en el PC de Andrés (Postgres local) y se ve desde el celular por Cloudflare Tunnel + Access.

Los reels se producen en `C:\Proyectos\btw-videos`. Este repo es solo el tablero.

**Empieza por `docs/requisitos.md`:** objetivos, arquitectura propuesta, fuentes de datos, modelo, pantallas, fases,
reglas que no se rompen y las preguntas para Andrés.

## Reglas cortas

- Las llaves solo en el servidor (secretos del despliegue o `.env.local` en desarrollo). Nunca en el repo, el
  navegador ni los registros.
- Nada se publica sin un clic de Andrés con confirmación.
- Cada cifra dice su fuente (Meta, Zernio o manual) y su antigüedad.
- El Supabase de producción de BTWash no se toca.
- Español, America/Bogota, pesos colombianos.
