# Tarea de las 8:00 (`btw-metricas-diarias`): leer del tablero

Hoy la tarea del PC de Andrés (`C:\Users\Andres\.claude\scheduled-tasks\btw-metricas-diarias\SKILL.md`) corre
`scripts/metricas.mjs`, que llama a Meta y Zernio y escribe sus propios CSV. Con el tablero ya no hace falta:
el tablero recolecta y guarda todo, y la tarea solo baja el CSV. **Este documento describe el cambio; la tarea
no se toca desde este servidor.**

## Cambio

1. En el `SKILL.md`, reemplazar el paso que corre `scripts/metricas.mjs` y escribe CSV por esta descarga
   (PowerShell):

   ```powershell
   curl.exe -sS -f -H "Authorization: Bearer $env:RECOLECTOR_SECRETO" `
     -o "$env:TEMP\metricas.csv" https://insights.btw-one.com/api/exportar/metricas.csv
   $filas = Import-Csv "$env:TEMP\metricas.csv" -Encoding UTF8
   ```

   Si responde 401, el secreto falta o está mal: la tarea avisa y se detiene (no reintenta con otra cosa).
2. **El secreto vive en una variable de entorno del PC** (`RECOLECTOR_SECRETO`, de usuario), nunca escrito en
   el `SKILL.md`, en un script ni en un CSV. Es el mismo valor de `RECOLECTOR_SECRETO` del servidor.
3. Dejar de llamar a las APIs de Meta y Zernio desde el PC y de escribir los CSV de antes.

## Qué trae el CSV

UTF-8, separador coma, una fila por publicación **y fuente** (`meta`, `zernio` o `manual`), con la última lectura
de esa fuente. Celda vacía = la fuente no dio el dato (no es 0). Fechas en ISO 8601 con zona (`...Z`, UTC;
Bogotá es UTC−5). Una publicación sin lecturas sale en una fila con `fuente` y cifras vacías.

Columnas: `reel, red, cuenta, estado, enlace, publicadoEn, fuente, via, datoActualizadoEn, leidoEn,
horasDesdePublicacion, vistas, alcance, meGusta, comentarios, compartidos, guardados, tiempoPromedioS,
pctCompleto, pctSalta3s, ret3s, seguidoresGanados`.

## Qué columnas usar

- **Fuente que manda por red:** TikTok = filas `fuente = zernio`; Instagram y Facebook = filas `fuente = meta`.
  Ignorar las otras filas de esa publicación salvo para completar un dato que falte (`pctSalta3s` de Instagram
  viene de la fila `zernio`).
- **Resumen del día:** filtrar `estado` = `publicado` o `parcial`; sumar `vistas` por `red` con la fila de la
  fuente que manda; mostrar `datoActualizadoEn` para decir qué tan fresco es.
- **Cifras de 48 h:** tomar solo filas con `horasDesdePublicacion` entre 36 y 60 (la más cercana a 48). Si no
  hay, escribir "sin dato a 48 h"; no rellenar con otra lectura. Para el reel: `vistas`, `tiempoPromedioS`
  (÷ duración del reel = % de la duración), `pctCompleto`, % que pasa del segundo 3 (`ret3s` en TikTok;
  `100 − pctSalta3s` en Instagram; Facebook no lo trae), y `guardados + compartidos`.
- **Enlace al video:** `enlace`; **qué reel es:** `reel` (vacío = publicación sin asignar).
