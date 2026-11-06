// Salud del servicio, para el HEALTHCHECK de Docker y los monitores. No lleva datos sensibles ni mensajes de error.
import { sql } from "drizzle-orm";
import { bd } from "@/servidor/db/cliente";

// Nunca se prerenderiza: debe consultar la base en cada llamada.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await bd().execute(sql`select 1`);
    return Response.json({ ok: true, base: "ok" });
  } catch {
    return Response.json({ ok: false, base: "sin conexión" }, { status: 503 });
  }
}
