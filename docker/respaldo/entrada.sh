#!/bin/sh
# Programa el respaldo diario a las 3:00 (hora de Bogotá, por TZ) y deja crond en primer plano.
set -eu
: "${PGPASSWORD:?Falta PGPASSWORD}"
umask 077
printf 'export PGHOST=%s PGUSER=%s PGDATABASE=%s PGPASSWORD=%s RETENCION=%s RESPALDO_HOST_PROPIETARIO=%s\n' \
  "${PGHOST:-db}" "${PGUSER:-btw}" "${PGDATABASE:-btw_insights}" "$PGPASSWORD" "${RETENCION:-30}" "${RESPALDO_HOST_PROPIETARIO:-}" > /etc/respaldo.env
echo "0 3 * * * /usr/local/bin/respaldar.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "$(date -Iseconds) respaldo listo: diario 03:00 ${TZ:-UTC}, se conservan ${RETENCION:-30}"
exec crond -f -l 8
