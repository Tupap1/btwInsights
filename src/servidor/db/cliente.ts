// Conexión a Postgres. Una sola por proceso, creada al primer uso.
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import * as esquema from "./esquema";

function crear() {
  const cliente = postgres(config().DATABASE_URL, { max: 5, onnotice: () => {} });
  return drizzle({ client: cliente, schema: esquema, casing: "snake_case" });
}

export type BaseDeDatos = ReturnType<typeof crear>;

let instancia: BaseDeDatos | undefined;

export function bd(): BaseDeDatos {
  instancia ??= crear();
  return instancia;
}

/** Cierra la conexión (para los comandos de consola, que deben terminar). */
export async function cerrarBd(): Promise<void> {
  if (instancia) await instancia.$client.end();
  instancia = undefined;
}
