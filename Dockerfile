# syntax=docker/dockerfile:1
# Imagen de producción del tablero. Construye igual en linux/amd64 y linux/arm64.
#
# Base: node:24-alpine. Es la más pequeña (~60 MB menos que -slim) y nada del proyecto necesita glibc:
# postgres.js, drizzle y zod son JavaScript puro; los binarios nativos de Tailwind (lightningcss) y esbuild (tsx)
# traen variante musl para x64 y arm64. Si algún día se suma una dependencia nativa sin musl, cambiar a -slim.
ARG NODE_IMAGE=node:24-alpine

# ---- deps: solo instala dependencias (se cachea mientras no cambie el lock) ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: next build -> .next/standalone ----
FROM deps AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# El proyecto no tiene public/ todavía; la etapa final lo copia igual.
RUN mkdir -p public && npm run build

# ---- herramientas: comandos de una sola vez (migraciones, importación). Con node_modules completo ----
# Las variables llegan por entorno (no hay .env.local), así que se llama a Node directo, sin --env-file:
#   node --import tsx scripts/migrar.ts
#   node --import tsx scripts/importar.ts   (cuando exista)
FROM build AS herramientas
ENV NODE_ENV=production
USER node
CMD ["node", "--import", "tsx", "scripts/migrar.ts"]

# ---- app: solo lo necesario para servir ----
FROM ${NODE_IMAGE} AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/salud >/dev/null || exit 1
CMD ["node", "server.js"]
