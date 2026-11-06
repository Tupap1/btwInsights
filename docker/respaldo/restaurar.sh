#!/bin/sh
# Restaura un respaldo sobre la base. BORRA y reemplaza lo que haya en ella.
# Uso (desde el servidor):
#   docker compose --env-file .env.produccion -f docker-compose.prod.yml stop app cron
#   docker compose --env-file .env.produccion -f docker-compose.prod.yml run --rm --entrypoint restaurar.sh respaldo <archivo.dump>
#   docker compose --env-file .env.produccion -f docker-compose.prod.yml up -d
# <archivo.dump> es el nombre dentro del volumen (para verlos: ... run --rm --entrypoint ls respaldo -lh /respaldos).
set -eu
: "${PGPASSWORD:?Falta PGPASSWORD}"
export PGHOST="${PGHOST:-db}" PGUSER="${PGUSER:-btw}" PGDATABASE="${PGDATABASE:-btw_insights}"
archivo="${1:?Uso: restaurar.sh <archivo.dump>}"
case "$archivo" in /*) ;; *) archivo="/respaldos/$archivo" ;; esac
[ -f "$archivo" ] || { echo "No existe $archivo"; exit 1; }
echo "Restaurando $archivo en $PGDATABASE (se reemplaza todo)..."
pg_restore --clean --if-exists --no-owner --exit-on-error -d "$PGDATABASE" "$archivo"
echo "Listo."
