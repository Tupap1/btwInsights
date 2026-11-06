// La URL de la base de pruebas: la de .env.local con otra base (btw_tablero_prueba). Vacía si no hay .env.local.
// La usan vitest.config.ts (para las pruebas) y preparar-bd.ts (que corre antes, fuera de las pruebas).
import { loadEnv } from "vite";

/** BD_PRUEBA_NOMBRE permite que dos procesos de pruebas en paralelo usen bases distintas. */
export const NOMBRE_BD_PRUEBA = /^btw_tablero_prueba\w*$/.test(process.env.BD_PRUEBA_NOMBRE ?? "")
  ? (process.env.BD_PRUEBA_NOMBRE as string)
  : "btw_tablero_prueba";

export function urlBdPrueba(): string {
  const local = loadEnv("test", process.cwd(), "")["DATABASE_URL"];
  if (!local) return "";
  const u = new URL(local);
  u.pathname = `/${NOMBRE_BD_PRUEBA}`;
  return u.toString();
}
