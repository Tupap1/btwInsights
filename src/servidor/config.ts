// Variables de entorno validadas. Solo el servidor importa este módulo: "server-only" rompe el build si un
// componente del navegador lo importa, así ninguna llave llega al bundle.
import "server-only";
import { z } from "zod";

const opcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const esquema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Cualquier Postgres 16 por TCP: el contenedor, Neon u otro. Pasar de uno a otro es cambiar esta línea. */
  DATABASE_URL: z.string().url(),
  META_PAGE_TOKEN: opcional,
  META_PAGE_ID: opcional,
  IG_USER_ID: opcional,
  GRAPH_VERSION: z.string().default("v25.0"),
  ZERNIO_API_KEY: opcional,
  RECOLECTOR_SECRETO: opcional,
  /** Carpeta de btw-videos, solo para la importación inicial. */
  BTW_VIDEOS_DIR: opcional,
});

export type Config = z.infer<typeof esquema>;

let cache: Config | undefined;

/** Lee y valida las variables una vez. Los errores nombran la variable, nunca su valor. */
export function config(): Config {
  if (cache) return cache;
  const r = esquema.safeParse(process.env);
  if (!r.success) {
    const faltan = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variables de entorno inválidas o faltantes: ${faltan}`);
  }
  cache = r.data;
  return cache;
}

/** Valores que nunca deben aparecer en registros, errores ni en el bundle. */
export function secretos(): string[] {
  const c = config();
  return [c.META_PAGE_TOKEN, c.ZERNIO_API_KEY, c.RECOLECTOR_SECRETO].filter((v): v is string => !!v && v.length >= 8);
}
