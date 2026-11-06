// Validación de un lead registrado a mano. Sin datos personales: solo canal, reel y una nota corta.
import { z } from "zod";
import { diaBogota } from "../consultas/tiempo";

export const CANALES = ["calculadora", "comentario", "dm", "whatsapp"] as const;
export const RESULTADOS = ["prueba", "venta", "nada"] as const;
export type Canal = (typeof CANALES)[number];
export type Resultado = (typeof RESULTADOS)[number];

export const MAX_NOTA = 500;

export interface LeadEntrada {
  fecha: string;
  canal: Canal;
  reelId: string | null;
  nota: string | null;
  resultado: Resultado | null;
}

const vacioANull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Fecha real "AAAA-MM-DD" (rechaza 2026-02-31). */
function esFechaReal(f: string): boolean {
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

/** El esquema depende de "hoy" en Bogotá: la fecha no puede ser futura. */
export function esquemaLead(ahora: Date) {
  const hoy = diaBogota(ahora);
  return z
    .object({
      fecha: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser AAAA-MM-DD.")
        .refine(esFechaReal, "La fecha no existe.")
        .refine((f) => f <= hoy, "La fecha no puede ser futura."),
      canal: z.enum(CANALES, { error: "Escoge un canal." }),
      reelId: z.preprocess(vacioANull, z.string().trim().min(1).max(64).optional()),
      nota: z.preprocess(vacioANull, z.string().trim().max(MAX_NOTA, `La nota admite hasta ${MAX_NOTA} caracteres.`).optional()),
      resultado: z.preprocess(vacioANull, z.enum(RESULTADOS).optional()),
    })
    .transform(
      (d): LeadEntrada => ({
        fecha: d.fecha,
        canal: d.canal,
        reelId: d.reelId ?? null,
        nota: d.nota ?? null,
        resultado: d.resultado ?? null,
      }),
    );
}

export function validarLead(
  crudo: unknown,
  ahora: Date,
): { ok: true; lead: LeadEntrada } | { ok: false; mensaje: string } {
  const r = esquemaLead(ahora).safeParse(crudo);
  if (r.success) return { ok: true, lead: r.data };
  return { ok: false, mensaje: r.error.issues[0]?.message ?? "Los datos no son válidos." };
}
