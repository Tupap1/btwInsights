import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { urlBdPrueba } from "./pruebas/url-bd";

// Las pruebas de base (*.bd.test.ts) usan btw_tablero_prueba en el mismo Postgres local: se crea desde cero en
// cada corrida (pruebas/preparar-bd.ts). De .env.local solo se toma DATABASE_URL, para armar esa URL; ninguna
// otra variable (ni las llaves de las APIs) llega a las pruebas.
const urlPrueba = urlBdPrueba();

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // "server-only" lanza error fuera de Next; en las pruebas se reemplaza por un módulo vacío.
    alias: { "server-only": fileURLToPath(new URL("./pruebas/vacio.ts", import.meta.url)) },
    env: urlPrueba ? { DATABASE_URL: urlPrueba } : {},
    projects: [
      {
        extends: true,
        test: { name: "unidad", include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], exclude: ["**/*.bd.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "bd",
          include: ["src/**/*.bd.test.ts"],
          fileParallelism: false,
          globalSetup: ["pruebas/preparar-bd.ts"],
        },
      },
    ],
  },
});
