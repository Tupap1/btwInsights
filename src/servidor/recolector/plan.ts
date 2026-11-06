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

/** T25, al entrar al tablero: además del plan, lo de menos de 30 días que no se lee hace 10 min o más. */
const EDAD_RECIENTE_MS = 30 * 24 * HORA;
const FRESCURA_MS = 10 * 60_000;

/**
 * Plan "al entrar": primero lo que toca por el plan normal (el más atrasado primero) y después, sin repetir, cada
 * publicación de menos de 30 días cuya última lectura tenga 10 min o más, empezando por la lectura más vieja.
 */
export function porLeerAlEntrar<T extends Pendiente>(ps: readonly T[], ahora: Date): T[] {
  const plan = porLeer(ps, ahora);
  const yaVan = new Set<T>(plan);
  const recientes = ps
    .filter(
      (p) =>
        !yaVan.has(p) &&
        ahora.getTime() - p.publicadoEn.getTime() < EDAD_RECIENTE_MS &&
        (p.ultimaLectura === null || ahora.getTime() - p.ultimaLectura.getTime() >= FRESCURA_MS),
    )
    .sort((a, b) => (a.ultimaLectura?.getTime() ?? 0) - (b.ultimaLectura?.getTime() ?? 0));
  return [...plan, ...recientes];
}
