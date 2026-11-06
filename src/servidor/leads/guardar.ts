// Guardar y listar leads. Solo escribe en la tabla `lead` de este tablero.
import "server-only";
import { desc, eq } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { lead, reel } from "../db/esquema";
import { validarLead } from "./esquema";

export interface LeadListado {
  id: number;
  fecha: string;
  canal: string;
  reelId: string | null;
  nota: string | null;
  resultado: string | null;
}

export async function guardarLead(
  db: BaseDeDatos,
  crudo: unknown,
  ahora: Date,
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const v = validarLead(crudo, ahora);
  if (!v.ok) return v;
  const { fecha, canal, reelId, nota, resultado } = v.lead;
  if (reelId !== null) {
    const [existe] = await db.select({ id: reel.id }).from(reel).where(eq(reel.id, reelId));
    if (!existe) return { ok: false, mensaje: "Ese reel no existe." };
  }
  await db.insert(lead).values({ fecha, canal, reelId, nota, resultado });
  return { ok: true };
}

/** Los últimos leads: primero la fecha más reciente, y a igual fecha, el último registrado. */
export async function listarUltimos(db: BaseDeDatos, n: number): Promise<LeadListado[]> {
  return db
    .select({ id: lead.id, fecha: lead.fecha, canal: lead.canal, reelId: lead.reelId, nota: lead.nota, resultado: lead.resultado })
    .from(lead)
    .orderBy(desc(lead.fecha), desc(lead.id))
    .limit(n);
}
