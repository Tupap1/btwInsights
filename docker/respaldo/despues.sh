#!/bin/sh
# PUNTO DE ENGANCHE: se ejecuta después de cada respaldo exitoso, con la ruta del archivo en $1.
# Aquí va la copia fuera del servidor (rclone a Drive, S3, scp...). Por ahora no hace nada.
# Para activarla: edita este archivo y reconstruye la imagen (docker compose ... build respaldo).
# La copia a una carpeta del host ya la hace respaldar.sh (RESPALDO_HOST_DIR); esto es para lo que vaya más lejos.
exit 0
