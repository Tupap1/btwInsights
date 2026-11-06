// Cuándo le toca una lectura nueva a cada publicación (requisitos, sección 8):
//   - en las primeras 72 h, cada 6 h;
//   - después, una vez al día hasta el día 30;
//   - después, una vez por semana.
// Lo que no alcance en una corrida queda para la siguiente: se ordena por atraso, el más atrasado primero.

const HORA = 3_600_000;

export interface Pendiente {
  publicacionId: number;
  publicadoEn: Date;
  /** Última lectura de la fuente principal de esa red, o null si nunca se leyó. */
  ultimaLectura: Date | null;
}

/** Cada cuánto se lee una publicación según su edad. */
export function intervaloMs(edadMs: number): number {
  if (edadMs < 72 * HORA) return 6 * HORA;
  if (edadMs < 30 * 24 * HORA) return 24 * HORA;
  return 7 * 24 * HORA;
}

/** Cuánto tiempo pasó desde que le tocaba leer (negativo si todavía no le toca). */
export function atrasoMs(p: Pendiente, ahora: Date): number {
  if (!p.ultimaLectura) return Number.POSITIVE_INFINITY;
  const edad = p.ultimaLectura.getTime() - p.publicadoEn.getTime();
  const tocaba = p.ultimaLectura.getTime() + intervaloMs(Math.max(0, edad));
  return ahora.getTime() - tocaba;
}

/** Las publicaciones a las que les toca leer, de la más atrasada a la menos. */
export function porLeer<T extends Pendiente>(ps: readonly T[], ahora: Date): T[] {
  return ps
    .map((p) => ({ p, atraso: atrasoMs(p, ahora) }))
    .filter((x) => x.atraso >= 0)
    .sort((a, b) => b.atraso - a.atraso)
    .map((x) => x.p);
}
