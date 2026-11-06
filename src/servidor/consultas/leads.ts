// Leads por semana y por canal, y la cifra de la tarjeta de /hoy. Semanas de lunes a domingo en Bogotá.
// Fuente de todo: `manual` (los registra Andrés a mano).
import "server-only";
import type { BaseDeDatos } from "../db/cliente";
import { lead } from "../db/esquema";
import { CANALES, type Canal } from "../leads/esquema";
import { sinDato, type Cifra } from "./cifras";
import { diaBogota, sumarDias } from "./tiempo";

/** Lo mínimo de un lead para contar. */
export interface LeadFila {
  fecha: string;
  canal: Canal;
  creadoEn: Date;
}

export interface SemanaLeads {
  /** Lunes de la semana, "AAAA-MM-DD". */
  semana: string;
  total: number;
  porCanal: Record<Canal, number>;
}

const canalesEnCero = (): Record<Canal, number> => ({ calculadora: 0, comentario: 0, dm: 0, whatsapp: 0 });

/** Lunes de la semana a la que pertenece el día "AAAA-MM-DD". */
export function inicioSemana(dia: string): string {
  const diaSemana = new Date(`${dia}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return sumarDias(dia, -((diaSemana + 6) % 7));
}

/** Las últimas `n` semanas (la actual primero). Una semana sin leads cuenta 0: es un conteo, no un dato faltante. */
export function leadsPorSemana(leads: readonly LeadFila[], hoy: string, n: number): SemanaLeads[] {
  const lunesActual = inicioSemana(hoy);
  const semanas: SemanaLeads[] = Array.from({ length: n }, (_, i) => ({
    semana: sumarDias(lunesActual, -7 * i),
    total: 0,
    porCanal: canalesEnCero(),
  }));
  for (const l of leads) {
    const s = semanas.find((x) => x.semana === inicioSemana(l.fecha));
    if (!s) continue;
    s.total += 1;
    s.porCanal[l.canal] += 1;
  }
  return semanas;
}

/** Todo el historial por canal. */
export function leadsPorCanal(leads: readonly LeadFila[]): Record<Canal, number> {
  const r = canalesEnCero();
  for (const l of leads) r[l.canal] += 1;
  return r;
}

/**
 * La tarjeta de /hoy: semana actual contra la anterior. Si nunca se registró un lead, "—" (no hay nada que contar);
 * si hubo alguno alguna vez, 0 es un conteo real.
 */
export function cifrasDeLeads(leads: readonly LeadFila[], ahora: Date): { actual: Cifra; anterior: Cifra } {
  if (leads.length === 0) return { actual: sinDato, anterior: sinDato };
  const lunes = inicioSemana(diaBogota(ahora));
  const lunesAnterior = sumarDias(lunes, -7);
  const sigLunes = sumarDias(lunes, 7);
  const de = (a: string, b: string): Cifra => {
    const dentro = leads.filter((l) => l.fecha >= a && l.fecha < b);
    const ultimo = dentro.reduce<Date | null>((m, l) => (m === null || l.creadoEn > m ? l.creadoEn : m), null);
    // Sin leads en la semana, el dato vigente es el último registro que se hizo (cuándo se miró el cuaderno).
    const respaldo = leads.reduce<Date | null>((m, l) => (m === null || l.creadoEn > m ? l.creadoEn : m), null);
    return { valor: dentro.length, fuente: "manual", datoActualizadoEn: ultimo ?? respaldo };
  };
  return { actual: de(lunes, sigLunes), anterior: de(lunesAnterior, lunes) };
}

// ---------- Consulta ----------

export async function cargarLeadsFila(db: BaseDeDatos): Promise<LeadFila[]> {
  const filas = await db.select({ fecha: lead.fecha, canal: lead.canal, creadoEn: lead.creadoEn }).from(lead);
  // El canal viene como texto libre de la base; lo que no es un canal conocido no se cuenta (no se inventa uno).
  return filas.flatMap((f) => ((CANALES as readonly string[]).includes(f.canal) ? [{ ...f, canal: f.canal as Canal }] : []));
}
