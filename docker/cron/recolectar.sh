#!/bin/sh
# Llama a la ruta de recolección. Registra solo la hora y el código HTTP: ni el secreto ni la respuesta.
set -u
. /etc/recolector.env
# El encabezado va por stdin (-K -) para que el secreto no aparezca en la lista de procesos.
codigo=$(printf 'header = "Authorization: Bearer %s"\n' "$RECOLECTOR_SECRETO" |
  curl -sS -K - -X POST -o /dev/null -w '%{http_code}' --max-time 300 "$URL_RECOLECTAR" 2>/dev/null) || codigo="sin respuesta"
echo "$(date -Iseconds) recolectar -> HTTP ${codigo}"
