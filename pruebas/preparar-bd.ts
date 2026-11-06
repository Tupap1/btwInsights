// Antes de las pruebas de base: crea desde cero la base btw_tablero_prueba en el mismo Postgres local y le aplica
// las migraciones. Nunca toca la base de uso diario. Si no hay DATABASE_URL, no hace nada (esas pruebas se saltan).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { NOMBRE_BD_PRUEBA, urlBdPrueba } from "./url-bd";

export default async function preparar(): Promise<void> {
  const url = urlBdPrueba();
  if (!url) return;
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const sqlAdmin = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    await sqlAdmin.unsafe(`drop database if exists ${NOMBRE_BD_PRUEBA} with (force)`);
    await crearConReintentos(sqlAdmin);
    // Solo la base de pruebas: no espera el fsync de cada commit (en WSL2 cuesta ~28 ms por commit y las pruebas
    // del recolector pasaban de 5 s). Si el equipo se apaga a mitad de una prueba, no importa perder esa base.
    await sqlAdmin.unsafe(`alter database ${NOMBRE_BD_PRUEBA} set synchronous_commit = off`);
  } finally {
    await sqlAdmin.end();
  }
  const cliente = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle({ client: cliente }), { migrationsFolder: "migraciones" });
  } finally {
    await cliente.end();
  }
}

/**
 * CREATE DATABASE copia template1 y falla ("is being accessed by other users", código 55006) si otro proceso de
 * pruebas (otra BD_PRUEBA_NOMBRE) está creando su base en ese mismo momento. Se reintenta unas veces.
 */
async function crearConReintentos(sqlAdmin: postgres.Sql): Promise<void> {
  for (let intento = 1; ; intento++) {
    try {
      await sqlAdmin.unsafe(`create database ${NOMBRE_BD_PRUEBA}`);
      return;
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      if (codigo !== "55006" || intento >= 20) throw e;
      await new Promise((r) => setTimeout(r, 250 + Math.random() * 750));
    }
  }
}
