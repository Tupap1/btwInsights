// Crea o actualiza los roles btw_app y btw_lectura en la base de DATABASE_URL (que debe ser del dueño).
// Uso: node --import tsx scripts/roles.ts   (con POSTGRES_APP_PASSWORD y POSTGRES_LECTURA_PASSWORD en el entorno)
// Es idempotente: se corre después de cada migración. Ninguna contraseña se imprime.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

export type ContrasenasRoles = { app: string; lectura: string };

/** Aplica scripts/roles.sql con la conexión del dueño. Las contraseñas viajan como parámetros, no en el texto. */
export async function aplicarRoles(urlDueno: string, contrasenas: ContrasenasRoles): Promise<void> {
  if (!contrasenas.app) throw new Error("Falta POSTGRES_APP_PASSWORD");
  if (!contrasenas.lectura) throw new Error("Falta POSTGRES_LECTURA_PASSWORD");
  const guion = readFileSync(fileURLToPath(new URL("./roles.sql", import.meta.url)), "utf8");
  // Una sola conexión: los ajustes de sesión (set_config) deben verlos el mismo guion.
  const cliente = postgres(urlDueno, { max: 1, onnotice: () => {} });
  try {
    await cliente`select set_config('btw.contrasena_app', ${contrasenas.app}, false),
      set_config('btw.contrasena_lectura', ${contrasenas.lectura}, false)`;
    await cliente.unsafe(guion);
    await cliente`select set_config('btw.contrasena_app', '', false), set_config('btw.contrasena_lectura', '', false)`;
  } finally {
    await cliente.end();
  }
}

async function principal(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  await aplicarRoles(url, {
    app: process.env.POSTGRES_APP_PASSWORD ?? "",
    lectura: process.env.POSTGRES_LECTURA_PASSWORD ?? "",
  });
  console.log("Roles aplicados.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e: unknown) => {
    // Los mensajes de Postgres y los nuestros no llevan contraseñas.
    console.error(`No se pudieron aplicar los roles: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
