# Mismo Postgres 16 que la base, así pg_dump y pg_restore coinciden en versión.
FROM postgres:16-alpine
RUN apk add --no-cache tzdata
COPY entrada.sh respaldar.sh restaurar.sh probar-restauracion.sh despues.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh
ENV TZ=America/Bogota
ENTRYPOINT ["/usr/local/bin/entrada.sh"]
