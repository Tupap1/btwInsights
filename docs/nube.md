# Pasar a la nube (si algún día hace falta)

Hoy corre en el servidor de BTW con Docker. Esta guía dice cómo pasar a la nube sin reescribir nada. No se hizo:
es solo el plan.

El código no cambia: la app, las migraciones y las pruebas son las mismas. Lo que cambia es dónde corre cada pieza.

## 1. Base: Neon Postgres

1. Crea el proyecto en Neon (Postgres 16 o más nuevo).
2. Pon la URL en `DATABASE_URL`, con `sslmode=require`. Es el único cambio de la app.
3. Restaura el último respaldo (`btw-insights-AAAAMMDD-HHMMSS.dump`, hecho con `pg_dump -Fc`). Va antes de migrar,
   porque el respaldo ya trae el historial de migraciones:
   ```bash
   pg_restore --no-owner --no-acl -d "$DATABASE_URL" btw-insights-AAAAMMDD-HHMMSS.dump
   ```
   `--no-acl` quita los permisos del respaldo. Por eso el paso 4 vuelve a darlos.
4. Corre las migraciones y los roles contra Neon, con `DATABASE_URL` del dueño:
   ```bash
   npm run db:migrar
   node --import tsx scripts/roles.ts      # con POSTGRES_APP_PASSWORD y POSTGRES_LECTURA_PASSWORD
   ```
5. Roles: `btw_app` y `btw_lectura` se crean con el rol dueño de Neon. **Hay que verificarlo:** el dueño debe poder
   crear roles (`CREATEROLE`). Si no puede, créalos desde el panel de Neon y luego corre `roles.ts`.

No pegues la URL de la base en el chat ni en git. Ponla en el entorno.

## 2. App: Vercel u otro host de Node

- **Vercel:** su plan Hobby prohíbe el uso comercial (ver `TRACKER.md`). Usa un plan que lo permita u otro host de Node.
- **Variables:** las mismas de `.env.produccion`, con `DATABASE_URL` de Neon. Las de Docker (`PROXY_RED`, `VERSION`,
  `RESPALDO_*`) no aplican. `POSTGRES_*` solo las usa el script de roles.
- **Dominio y passkeys:** `WEBAUTHN_RP_ID` y `WEBAUTHN_ORIGEN` deben ser el dominio nuevo. Las llaves de acceso
  registradas valen solo para el `RP_ID` con el que se registraron. Si cambia el dominio, hay que volver a invitar a
  cada persona (`npm run invitar -- "<nombre>"` en el entorno nuevo).

## 3. Recolector

Hace falta llamar a `POST /api/recolectar` cada hora, con la cabecera `Authorization: Bearer $RECOLECTOR_SECRETO`.
Dos opciones:

- **GitHub Actions:** un workflow programado con `cron: "0 * * * *"`. El secreto va en los secretos del repositorio.
- **Vercel Cron:** el plan Hobby tiene límite de frecuencia. Verifícalo antes de usarlo.

Cada corrida dura menos de 60 segundos.

## 4. Respaldos

- Un job programado que corra `pg_dump -Fc` contra `DATABASE_URL` y guarde el archivo fuera de la nube.
- O los respaldos que ofrezca Neon. Revisa qué incluye su plan antes de depender de ellos.

## Lo que no cambia

- El código de la app y las pruebas.
- Las migraciones de `migraciones/`.
- Las reglas de `CLAUDE.md`: las llaves solo en el servidor, nada se publica en Zernio ni en Meta, y el Supabase de
  BTWash no se toca.
