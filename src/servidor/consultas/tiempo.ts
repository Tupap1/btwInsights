// Días y horas en America/Bogota (UTC-5, sin horario de verano). Todo el tablero cuenta los días así.
export const HORA_MS = 3_600_000;
export const DIA_MS = 24 * HORA_MS;
const DESFASE_BOGOTA_MS = 5 * HORA_MS;

/** "AAAA-MM-DD" del día de Bogotá en que cae el momento. */
export function diaBogota(f: Date): string {
  return new Date(f.getTime() - DESFASE_BOGOTA_MS).toISOString().slice(0, 10);
}

/** Momento (UTC) en que empieza ese día de Bogotá. */
export function inicioDiaBogota(dia: string): Date {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + DESFASE_BOGOTA_MS);
}

/** Suma días calendario a un "AAAA-MM-DD". */
export function sumarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
}

/** Reloj del servidor. Está aparte para que ningún componente llame a Date directo al pintar. */
export function ahoraServidor(): Date {
  return new Date();
}
