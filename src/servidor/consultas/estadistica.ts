// Mediana y comparación contra la mediana. Sin interpolar: los valores que faltan (null) no cuentan.

/** Mediana de los valores que existen; null si no hay ninguno. */
export function mediana(valores: readonly (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mitad = Math.floor(v.length / 2);
  const centro = v[mitad];
  const anterior = v[mitad - 1];
  if (centro === undefined) return null;
  return v.length % 2 === 1 || anterior === undefined ? centro : (anterior + centro) / 2;
}

export interface Comparacion {
  /** Arriba o abajo de la mediana; null si no se puede comparar. */
  tono: "arriba" | "abajo" | "igual" | null;
  /** Más del doble o menos de la mitad de la mediana. */
  atipico: boolean;
}

export function compararConMediana(valor: number | null, med: number | null): Comparacion {
  if (valor === null || med === null || med <= 0) return { tono: null, atipico: false };
  const tono = valor > med ? "arriba" : valor < med ? "abajo" : "igual";
  return { tono, atipico: valor > 2 * med || valor < med / 2 };
}
