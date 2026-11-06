// Ayudas para las pruebas que usan la base btw_tablero_prueba (archivos *.bd.test.ts).
import { sql } from "drizzle-orm";
import type { BaseDeDatos } from "../src/servidor/db/cliente";

export const hayBd = !!process.env.DATABASE_URL;

/** Deja todas las tablas vacías y los contadores en 1. */
export async function vaciar(db: BaseDeDatos): Promise<void> {
  await db.execute(
    sql`truncate table lectura, curva_retencion, cuenta_lectura, alerta, corrida, idea, lead, publicacion, reel restart identity cascade`,
  );
}
