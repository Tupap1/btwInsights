// Ayudas para las pruebas que usan la base btw_tablero_prueba (archivos *.bd.test.ts).
import { sql } from "drizzle-orm";
import type { BaseDeDatos } from "../src/servidor/db/cliente";

export const hayBd = !!process.env.DATABASE_URL;

/** Deja todas las tablas vacías y los contadores en 1. */
export async function vaciar(db: BaseDeDatos): Promise<void> {
  await db.execute(
    sql`truncate table comentario, hilo_comentarios, lectura, curva_retencion, cuenta_lectura, alerta, corrida, idea, lead, publicacion, reel restart identity cascade`,
  );
  await vaciarAcceso(db);
}

/** Vacía solo las tablas de acceso (T09). Con delete: un truncate cuesta ~400 ms cada una en WSL2. */
export async function vaciarAcceso(db: BaseDeDatos): Promise<void> {
  for (const t of ["desafio", "invitacion", "sesion", "credencial", "usuario"]) await db.execute(sql.raw(`delete from ${t}`));
  await db.execute(sql`alter table usuario alter column id restart with 1`);
}
