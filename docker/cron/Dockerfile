FROM alpine:3.21
RUN apk add --no-cache curl tzdata
COPY entrada.sh recolectar.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrada.sh /usr/local/bin/recolectar.sh
ENV TZ=America/Bogota
ENTRYPOINT ["/usr/local/bin/entrada.sh"]
