#!/bin/sh
# Instala la tarea (cada hora, minuto 0) y deja crond en primer plano. El secreto llega por entorno y se guarda en un
# archivo privado, porque crond no pasa el entorno a sus tareas.
set -eu
: "${RECOLECTOR_SECRETO:?Falta RECOLECTOR_SECRETO}"
URL="${URL_RECOLECTAR:-http://app:3000/api/recolectar}"
umask 077
printf 'RECOLECTOR_SECRETO=%s\nURL_RECOLECTAR=%s\n' "$RECOLECTOR_SECRETO" "$URL" > /etc/recolector.env
echo "0 * * * * /usr/local/bin/recolectar.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "$(date -Iseconds) cron listo: POST cada hora a $URL"
exec crond -f -l 8
