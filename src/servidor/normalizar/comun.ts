// Utilidades compartidas por los normalizadores de Zernio y de Meta. Puras: sin red ni base de datos.
import { z } from "zod";
import type { Red } from "../tipos";

/** Número finito o null. Cualquier otra cosa (texto, NaN, undefined) es "sin dato". */
export const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Redondea para quitar el ruido de coma flotante (0.0337 * 100 = 3.3700000000000001), no para recortar el dato. */
export const redondear = (v: number, decimales: number): number => {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
};

/** Milisegundos → segundos (3 decimales: es exacto, ms/1000 no pierde nada). */
export const msASegundos = (v: unknown): number | null => {
  const n = numero(v);
  return n === null ? null : redondear(n / 1000, 3);
};

/** Fracción 0-1 → porcentaje 0-100 (2 decimales). */
export const fraccionAPct = (v: unknown): number | null => {
  const n = numero(v);
  return n === null ? null : redondear(n * 100, 2);
};

/** Número de entrada con los decimales justos (segundos de duración de Zernio, p. ej. 43.286). */
export const limpiar = (v: unknown, decimales = 3): number | null => {
  const n = numero(v);
  return n === null ? null : redondear(n, decimales);
};

/** Texto no vacío o null. */
export const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Fecha desde un texto ISO. Acepta el "+0000" de Meta (sin dos puntos). Inválida o ausente → null. */
export const fecha = (v: unknown): Date | null => {
  if (typeof v !== "string" || v === "") return null;
  const d = new Date(v.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Objeto cualquiera → solo sus valores numéricos. Ausente o de otro tipo → null. */
export const mapaNumerico = (v: unknown): Record<string, number> | null => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const salida: Record<string, number> = {};
  for (const [k, x] of Object.entries(v)) {
    const n = numero(x);
    if (n !== null) salida[k] = n;
  }
  return salida;
};

/** Mapa de fracciones 0-1 → 0-100. Vacío → null. */
export const mapaFraccionAPct = (v: unknown): Record<string, number> | null => {
  const m = mapaNumerico(v);
  if (m === null || Object.keys(m).length === 0) return null;
  return Object.fromEntries(Object.entries(m).map(([k, x]) => [k, redondear(x * 100, 2)]));
};

/** País de mayor valor, sin "other", con su porcentaje 0-100. */
export const paisPrincipal = (v: unknown): { codigo: string; pct: number } | null => {
  const m = mapaNumerico(v);
  if (m === null) return null;
  let mejor: [string, number] | null = null;
  for (const [codigo, valor] of Object.entries(m)) {
    if (codigo.toLowerCase() === "other") continue;
    if (mejor === null || valor > mejor[1]) mejor = [codigo, valor];
  }
  return mejor === null ? null : { codigo: mejor[0], pct: redondear(mejor[1] * 100, 2) };
};

/** Suma de los valores de un mapa. */
export const sumar = (m: Record<string, number>): number => Object.values(m).reduce((a, b) => a + b, 0);

/** Plataforma de la fuente → Red del dominio. Las que no seguimos (youtube, etc.) → null. */
export const aRed = (v: unknown): Red | null => (v === "tiktok" || v === "instagram" || v === "facebook" ? v : null);

/** Error cuyo mensaje no copia datos de la respuesta (ni ids, ni textos, ni URLs). */
export const errorDeForma = (que: string): Error => new Error(`Respuesta con forma inesperada: ${que}`);

/** Esquemas tolerantes: un campo con el tipo equivocado se trata como ausente, no tumba la lectura. */
export const textoTolerante = z.string().nullish().catch(undefined);
export const numeroTolerante = z.number().nullish().catch(undefined);
export const objetoTolerante = z.record(z.string(), z.unknown()).nullish().catch(undefined);
