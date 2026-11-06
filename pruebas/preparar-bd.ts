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
    await sqlAdmin.unsafe(`create database ${NOMBRE_BD_PRUEBA}`);
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
