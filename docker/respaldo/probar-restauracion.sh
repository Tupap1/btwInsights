#!/bin/sh
# Prueba que el último respaldo sirve: lo restaura en una base aparte, compara los conteos de las tablas con los de la
# base original y borra la base aparte. No toca la base original.
# Uso: docker compose ... run --rm --entrypoint probar-restauracion.sh respaldo [--respaldar-antes]
#   --respaldar-antes  hace un respaldo nuevo primero (así los conteos coinciden aunque haya datos nuevos).
# Sale con 0 si todos los conteos coinciden; 1 si no.
set -eu
: "${PGPASSWORD:?Falta PGPASSWORD}"
export PGHOST="${PGHOST:-db}" PGUSER="${PGUSER:-btw}"
original="${PGDATABASE:-btw_insights}"
aparte="${original}_restauracion"
export PGDATABASE=postgres   # para crear y borrar bases; las consultas indican su base con -d

if [ "${1:-}" = "--respaldar-antes" ]; then
  [ -f /etc/respaldo.env ] || printf 'export PGHOST=%s PGUSER=%s PGDATABASE=%s PGPASSWORD=%s RETENCION=%s\n' \
    "$PGHOST" "$PGUSER" "$original" "$PGPASSWORD" "${RETENCION:-30}" > /etc/respaldo.env
  /usr/local/bin/respaldar.sh
fi

ultimo=$(ls -1t /respaldos/btw-insights-*.dump 2>/dev/null | head -n 1 || true)
[ -n "$ultimo" ] || { echo "No hay respaldos en /respaldos"; exit 1; }
echo "Probando $ultimo"

limpiar() { psql -qAt -d postgres -c "drop database if exists $aparte with (force)" >/dev/null 2>&1 || true; }
trap limpiar EXIT
limpiar
psql -qAt -d postgres -c "create database $aparte" >/dev/null
pg_restore --no-owner --exit-on-error -d "$aparte" "$ultimo"

# Conteo de cada tabla de public (sin sesion ni desafio: caducan solas y cambian entre un momento y otro).
consulta=$(psql -qAt -d "$aparte" -c "select 'select * from (' || string_agg(format('select %L as tabla, count(*) as filas from public.%I', tablename, tablename), ' union all ' order by tablename) || ') x order by tabla' from pg_tables where schemaname = 'public' and tablename not in ('sesion', 'desafio')")
[ -n "$consulta" ] || { echo "La base restaurada no tiene tablas"; exit 1; }
psql -qAt -F ' = ' -d "$aparte" -c "$consulta" > /tmp/conteo-restaurada.txt
psql -qAt -F ' = ' -d "$original" -c "$consulta" > /tmp/conteo-original.txt

echo "Conteos de la base restaurada:"
cat /tmp/conteo-restaurada.txt
if diff /tmp/conteo-original.txt /tmp/conteo-restaurada.txt >/tmp/diferencias.txt; then
  echo "OK: los conteos coinciden con la base original ($original). Base aparte borrada."
else
  echo "DIFIEREN (original < >restaurada). Si hubo datos nuevos después del respaldo, repite con --respaldar-antes:"
  cat /tmp/diferencias.txt
  exit 1
fi
