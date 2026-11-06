// Formato en español de Colombia: punto de miles, coma decimal, pesos y horas de Bogotá.
import type { Fuente } from "../tipos";
import { DIA_MS, HORA_MS } from "./tiempo";

const entero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0, useGrouping: "always" });
const unDecimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1, useGrouping: "always" });
const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
  useGrouping: "always",
});

export const formatoEntero = (n: number): string => entero.format(n);
export const formatoDecimal = (n: number): string => unDecimal.format(n);
export const formatoPesos = (n: number): string => pesos.format(n);
export const formatoPorcentaje = (n: number): string => `${unDecimal.format(n)} %`;
export const formatoSegundos = (n: number): string => `${unDecimal.format(n)} s`;

const fechaCorta = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
const fechaDia = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const fechaHora = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const soloHora = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });

export const formatoFechaCorta = (f: Date): string => fechaCorta.format(f);
export const formatoFechaDia = (f: Date): string => fechaDia.format(f);
export const formatoFechaHora = (f: Date): string => fechaHora.format(f);
export const formatoHora = (f: Date): string => soloHora.format(f);

/** "hace 12 min", "hace 3 h", "hace 2 d". */
export function haceCuanto(f: Date, ahora: Date): string {
  const ms = Math.max(0, ahora.getTime() - f.getTime());
  if (ms < HORA_MS) return `hace ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (ms < 2 * DIA_MS) return `hace ${Math.round(ms / HORA_MS)} h`;
  return `hace ${Math.round(ms / DIA_MS)} d`;
}

export const NOMBRE_FUENTE: Record<Fuente, string> = { meta: "Meta", zernio: "Zernio", manual: "manual" };
