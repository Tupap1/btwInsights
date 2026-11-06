import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/servidor/db/esquema.ts",
  out: "./migraciones",
  casing: "snake_case",
  strict: true,
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
