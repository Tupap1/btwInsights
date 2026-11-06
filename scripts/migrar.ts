// Aplica las migraciones de migraciones/ con el mismo código en local y en cualquier Postgres (Neon incluido).
// Uso: npm run db:migrar
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL_MIGRACIONES ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (o DATABASE_URL_MIGRACIONES).");
  process.exit(1);
}

const cliente = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle({ client: cliente }), { migrationsFolder: "migraciones" });
  console.log("Migraciones aplicadas.");
} catch (e) {
  // El mensaje de Postgres no trae la contraseña; igual no se imprime la URL. Drizzle envuelve el error real en
  // "cause" (sin él solo se ve "Failed query: ..."), así que se muestra también.
  const causa = e instanceof Error && e.cause instanceof Error ? ` (causa: ${e.cause.message})` : "";
  console.error(`No se pudieron aplicar las migraciones: ${e instanceof Error ? e.message : String(e)}${causa}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
