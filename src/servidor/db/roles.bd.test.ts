import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd } from "../../../pruebas/bd";
import { aplicarRoles } from "../../../scripts/roles";

// Los roles son de todo el clúster de Postgres; los permisos, de la base de pruebas. Las contraseñas se generan aquí.
const contrasenas = { app: randomBytes(18).toString("hex"), lectura: randomBytes(18).toString("hex") };

function urlComo(rol: string, contrasena: string): string {
  const u = new URL(process.env.DATABASE_URL as string);
  u.username = rol;
  u.password = contrasena;
  return u.toString();
}

describe.skipIf(!hayBd)("roles de la base", () => {
  const urlDueno = process.env.DATABASE_URL as string;
  const tablasConDelete = ["sesion", "desafio", "invitacion"];
  const creadas: string[] = []; // solo se borran las que esta prueba creó (las reales vienen de las migraciones)
  let dueno: postgres.Sql;
  let app: postgres.Sql;
  let lectura: postgres.Sql;

  beforeAll(async () => {
    dueno = postgres(urlDueno, { max: 1, onnotice: () => {} });
    await aplicarRoles(urlDueno, contrasenas);
    // Tablas que T09 agrega en la migración 0001; aquí se crean si aún no existen, y se vuelven a aplicar los roles.
    for (const t of tablasConDelete) {
      const [r] = await dueno`select to_regclass(${`public.${t}`}) as existe`;
      if (r?.["existe"] === null) {
        await dueno.unsafe(`create table ${t} (id text primary key)`);
        creadas.push(t);
      }
    }
    await aplicarRoles(urlDueno, contrasenas);
    app = postgres(urlComo("btw_app", contrasenas.app), { max: 1, onnotice: () => {} });
    lectura = postgres(urlComo("btw_lectura", contrasenas.lectura), { max: 1, onnotice: () => {} });
  });

  afterAll(async () => {
    await app?.end();
    await lectura?.end();
    await dueno?.unsafe("truncate table reel, corrida restart identity cascade");
    for (const t of creadas) await dueno?.unsafe(`drop table if exists ${t}`);
    await dueno?.end();
  });

  it("btw_app puede SELECT, INSERT y UPDATE", async () => {
    await app`insert into reel (id) values ('t12')`;
    await app`update reel set id = 't12' where id = 't12'`;
    const filas = await app`select id from reel where id = 't12'`;
    expect(filas).toHaveLength(1);
  });

  it("btw_app inserta en tablas con identidad sin permiso sobre su secuencia", async () => {
    const [fila] = await app`insert into corrida (origen) values ('cli') returning id`;
    expect(fila?.["id"]).toBeGreaterThan(0);
  });

  it("btw_app no puede borrar de reel", async () => {
    await expect(app`delete from reel where id = 't12'`).rejects.toThrow(/permission denied/);
  });

  it("btw_app solo puede borrar de sesion, desafio e invitacion", async () => {
    for (const t of tablasConDelete) {
      const [r] = await dueno`select has_table_privilege('btw_app', ${`public.${t}`}, 'DELETE') as puede`;
      expect(r?.["puede"], t).toBe(true);
    }
    const [otras] = await dueno`select count(*)::int as n from information_schema.role_table_grants
      where grantee = 'btw_app' and privilege_type = 'DELETE' and table_schema = 'public'
        and table_name <> all (${tablasConDelete})`;
    expect(otras?.["n"]).toBe(0);
  });

  it("btw_app no puede hacer DDL", async () => {
    await expect(app`create table intruso (id int)`).rejects.toThrow(/permission denied/);
    await expect(app`drop table reel`).rejects.toThrow(/must be owner/);
    await expect(app`truncate reel`).rejects.toThrow(/permission denied/);
  });

  it("btw_lectura lee pero no escribe", async () => {
    expect(await lectura`select id from reel where id = 't12'`).toHaveLength(1);
    await expect(lectura`insert into reel (id) values ('t12b')`).rejects.toThrow(/permission denied/);
    await expect(lectura`update reel set id = 't12'`).rejects.toThrow(/permission denied/);
    await expect(lectura`delete from reel`).rejects.toThrow(/permission denied/);
  });

  it("una tabla creada después por el dueño queda con los mismos permisos", async () => {
    await dueno`create table futura_t12 (id text primary key)`;
    try {
      await app`insert into futura_t12 (id) values ('a')`;
      expect(await lectura`select id from futura_t12`).toHaveLength(1);
      await expect(app`delete from futura_t12`).rejects.toThrow(/permission denied/);
    } finally {
      await dueno`drop table futura_t12`;
    }
  });

  it("correr los roles otra vez no falla y conserva los permisos", async () => {
    await aplicarRoles(urlDueno, contrasenas);
    await expect(app`delete from reel`).rejects.toThrow(/permission denied/);
    expect((await app`select 1 as uno`)[0]?.["uno"]).toBe(1);
  });

  it("sin contraseñas falla nombrando la variable, sin valores", async () => {
    await expect(aplicarRoles(urlDueno, { app: "", lectura: "x" })).rejects.toThrow(/POSTGRES_APP_PASSWORD/);
    await expect(aplicarRoles(urlDueno, { app: "x", lectura: "" })).rejects.toThrow(/POSTGRES_LECTURA_PASSWORD/);
  });
});
