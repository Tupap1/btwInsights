# btw-tablero: reglas para cualquier sesión o subagente

Tablero de contenido de BTW (`insights.btw-one.com`). Requisitos: `docs/requisitos.md`. Estado, decisiones y tareas:
`TRACKER.md` (léelo primero; ahí dice qué archivos son de cada tarea).

## No se negocia
- **Llaves:** nunca abras, imprimas ni copies `.env.local`. Las llaves solo se usan en `src/servidor/` (con
  `import "server-only"`). Ningún error, registro ni URL que se muestre lleva una llave.
- **Nada se publica:** en la fase 1, a Zernio y a Meta solo se les hace GET. Ningún POST, PUT ni DELETE.
- **No se inventan cifras:** `null` = la fuente no dio el dato (nunca 0 en su lugar). No se interpola. Cada cifra
  guarda su fuente (`meta`, `zernio` o `manual`) y cuándo estaba vigente.
- **El Supabase de BTWash no se toca**, ni el de producción ni el local.
- **Sin commits:** solo Andrés los pide.

## Cómo se escribe
- TypeScript estricto, sin `any`. Lo que llega de afuera (APIs, CSV, JSON) se valida con zod.
- Todo en español: nombres, comentarios, mensajes. Hora de America/Bogota; pesos colombianos con punto de miles.
- Next.js 16.4: antes de escribir código de Next, lee la guía puntual en `node_modules/next/dist/docs/` (no toda).
  Sin `cacheComponents`.
- Nada de rutas de Windows en el código: salen de variables de entorno.
- Pruebas con Vitest, junto al archivo (`x.test.ts`). Datos reales en `pruebas/fixtures/`:
  - `api/`: respuestas reales de Zernio y Meta, sin llaves (`npm run grabar-fixtures`);
  - `btw-videos/`: copias de los CSV, del calendario y de los `texto.txt` de `btw-videos/publicar`.
  Ninguna prueba llama a las APIs reales.
- Antes de terminar: `npm run verificar` (tsc, eslint y vitest).
