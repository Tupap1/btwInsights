// T25: cuándo deja de preguntar el navegador por la lectura que pidió al entrar. Pura, para probarla.

export interface EstadoLectura {
  enCurso: boolean;
  ultima: { iniciadaEn: string } | null;
}

const TOPE_MS = 120_000;
const ARRANQUE_MS = 10_000;

/**
 * `iniciada`: el servidor lanzó una lectura nueva; se espera a que termine una corrida que empezó después del pedido
 * (con 1 s de holgura). Si a los 10 s no hay ninguna en curso, otra pestaña o el cron ganó el candado: se deja.
 * `en_curso`: ya había una; se espera a que deje de estar en curso. Nunca más de 2 min.
 */
export function sigueEsperando(
  e: EstadoLectura,
  modo: "iniciada" | "en_curso",
  desdeMs: number,
  transcurridoMs: number,
): boolean {
  if (transcurridoMs >= TOPE_MS) return false;
  if (e.enCurso) return true;
  if (modo === "en_curso") return false;
  const termino = e.ultima !== null && Date.parse(e.ultima.iniciadaEn) >= desdeMs - 1000;
  return !termino && transcurridoMs < ARRANQUE_MS;
}
