#!/bin/sh
# Respaldo diario: pg_dump -Fc a /respaldos, conserva los últimos RETENCION (30) y llama al enganche.
set -eu
umask 077
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
# Copia a la carpeta del host (bind mount en /respaldos-host), con la misma retención. Si falla, el del volumen queda.
if [ -d /respaldos-host ]; then
  if cp "$destino" "/respaldos-host/$destino.parcial" && mv "/respaldos-host/$destino.parcial" "/respaldos-host/$destino"; then
    [ -n "${RESPALDO_HOST_PROPIETARIO:-}" ] && chown "$RESPALDO_HOST_PROPIETARIO" "/respaldos-host/$destino" || true
    (cd /respaldos-host && ls -1t btw-insights-*.dump 2>/dev/null | tail -n +"$((RETENCION + 1))" | xargs -r rm -f --)
    echo "$(date -Iseconds) copia al host ok: $destino"
  else
    rm -f "/respaldos-host/$destino.parcial"
    echo "$(date -Iseconds) copia al host FALLÓ (el respaldo del volumen sí quedó)"
  fi
fi
# Enganche para la copia fuera del servidor (otra tarea): ver despues.sh
/usr/local/bin/despues.sh "/respaldos/$destino" || echo "$(date -Iseconds) despues.sh falló (el respaldo local sí quedó)"
