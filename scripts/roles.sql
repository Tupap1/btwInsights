-- Roles de la base. Idempotente: se corre después de cada migración, como dueño de la base.
-- Las contraseñas llegan como ajustes de la sesión (btw.contrasena_app, btw.contrasena_lectura) y se escapan con
-- format(%L); nunca se concatenan a mano. El dueño es current_user (btw en producción, btw_dueno en desarrollo).
--   btw_app:     SELECT, INSERT, UPDATE en las tablas de public; DELETE solo en sesion, desafio e invitacion;
--                sin DDL. Las columnas "generated ... as identity" no piden permiso sobre su secuencia.
--   btw_lectura: solo SELECT.
do $roles$
declare
  dueno text := current_user;
  bd text := current_database();
  tabla text;
begin
  if coalesce(current_setting('btw.contrasena_app', true), '') = '' then
    raise exception 'Falta la contraseña de btw_app (POSTGRES_APP_PASSWORD)';
  end if;
  if coalesce(current_setting('btw.contrasena_lectura', true), '') = '' then
    raise exception 'Falta la contraseña de btw_lectura (POSTGRES_LECTURA_PASSWORD)';
  end if;

  -- Crear (o actualizar la contraseña de) cada rol. Sin superusuario, sin crear bases ni roles.
  if not exists (select 1 from pg_roles where rolname = 'btw_app') then
    execute format('create role btw_app login nosuperuser nocreatedb nocreaterole noinherit password %L',
      current_setting('btw.contrasena_app'));
  else
    execute format('alter role btw_app login nosuperuser nocreatedb nocreaterole password %L',
      current_setting('btw.contrasena_app'));
  end if;
  if not exists (select 1 from pg_roles where rolname = 'btw_lectura') then
    execute format('create role btw_lectura login nosuperuser nocreatedb nocreaterole noinherit password %L',
      current_setting('btw.contrasena_lectura'));
  else
    execute format('alter role btw_lectura login nosuperuser nocreatedb nocreaterole password %L',
      current_setting('btw.contrasena_lectura'));
  end if;

  -- Entrar a esta base y ver el esquema public; sin crear nada en él.
  execute format('grant connect on database %I to btw_app, btw_lectura', bd);
  revoke create on schema public from btw_app, btw_lectura;
  grant usage on schema public to btw_app, btw_lectura;

  -- Se parte de cero en las tablas existentes, para que volver a correr también quite lo que sobre.
  revoke all on all tables in schema public from btw_app, btw_lectura;
  grant select, insert, update on all tables in schema public to btw_app;
  grant select on all tables in schema public to btw_lectura;
  foreach tabla in array array['sesion', 'desafio', 'invitacion'] loop
    if to_regclass(format('public.%I', tabla)) is not null then
      execute format('grant delete on public.%I to btw_app', tabla);
    end if;
  end loop;

  -- Tablas futuras que cree el dueño (migraciones): mismos permisos, sin DELETE.
  execute format('alter default privileges for role %I in schema public grant select, insert, update on tables to btw_app', dueno);
  execute format('alter default privileges for role %I in schema public grant select on tables to btw_lectura', dueno);
end
$roles$;
