#!/bin/sh
# Respaldo diario: pg_dump -Fc a /respaldos, conserva los últimos RETENCION (30) y llama al enganche.
set -eu
. /etc/respaldo.env
cd /respaldos
destino="btw-insights-$(date +%Y%m%d-%H%M%S).dump"
if pg_dump -Fc -f "$destino.parcial"; then
  mv "$destino.parcial" "$destino"
  echo "$(date -Iseconds) respaldo ok: $destino ($(du -h "$destino" | cut -f1))"
else
  rm -f "$destino.parcial"
  echo "$(date -Iseconds) respaldo FALLÓ"
  exit 1
fi
# Rotación: borra los más viejos y deja los últimos RETENCION.
ls -1t btw-insights-*.dump 2>/dev/null | tail -n +"$((RETENCION + 1))" | xargs -r rm -f --
# Enganche para la copia fuera del servidor (otra tarea): ver despues.sh
/usr/local/bin/despues.sh "/respaldos/$destino" || echo "$(date -Iseconds) despues.sh falló (el respaldo local sí quedó)"
