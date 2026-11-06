// T25: al entrar al tablero se pide una lectura nueva, sin lanzar una por cada pestaña o vuelta.
// Función pura: la ruta /api/actualizar le pasa la última corrida y la hora.

const MIN = 60_000;
/** Una corrida "en curso" más vieja que esto se da por abandonada (igual que el candado del recolector). */
const EN_CURSO_MAX_MS = 10 * MIN;
/** Si la última empezó hace menos de esto, no se lanza otra. */
const RECIENTE_MS = 2 * MIN;

export type EstadoCorrida = "en_curso" | "ok" | "parcial" | "error" | "abandonada";
export type DecisionAlEntrar = "en_curso" | "reciente" | "iniciar";

export function decidirAlEntrar(
  ultima: { estado: EstadoCorrida; iniciadaEn: Date } | null,
  ahora: Date,
): DecisionAlEntrar {
  if (!ultima) return "iniciar";
  const edad = ahora.getTime() - ultima.iniciadaEn.getTime();
  if (ultima.estado === "en_curso" && edad < EN_CURSO_MAX_MS) return "en_curso";
  if (ultima.estado !== "en_curso" && edad < RECIENTE_MS) return "reciente";
  return "iniciar";
}
