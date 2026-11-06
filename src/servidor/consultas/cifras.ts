// Cómo se decide qué lectura y qué fuente muestran cada cifra. Todo puro, con pruebas.
// Regla de los datos: null = la fuente no dio el dato. Nunca se rellena ni se interpola.
import type { Cifras, Fuente, Red, Via } from "../tipos";

/** Una cifra tal como la pinta <Cifra>: valor, quién la dio y cuándo estaba vigente. */
export interface Cifra {
  valor: number | null;
  fuente: Fuente | null;
  datoActualizadoEn: Date | null;
}

export const sinDato: Cifra = { valor: null, fuente: null, datoActualizadoEn: null };

/** Una lectura de la base, con lo mínimo que hace falta para escoger. */
export interface LecturaDato extends Cifras {
  fuente: Fuente;
  via: Via;
  datoActualizadoEn: Date;
  horasDesdePublicacion: number | null;
  paisPrincipal?: string | null;
  paisPrincipalPct?: number | null;
}

/** Hasta cuántas horas de distancia vale una lectura como "la de ese momento". */
export const TOLERANCIA_HORAS = 12;

export type Objetivo = { tipo: "horas"; horas: number } | { tipo: "ultima" };
export const OBJETIVO_48H: Objetivo = { tipo: "horas", horas: 48 };
export const OBJETIVO_7D: Objetivo = { tipo: "horas", horas: 168 };
export const OBJETIVO_ULTIMA: Objetivo = { tipo: "ultima" };

export interface Cercana<T> {
  lectura: T;
  /** Horas reales desde la publicación. */
  horasReales: number;
  /** Más de 12 h lejos del objetivo: se muestra "aprox." con la hora real. */
  aprox: boolean;
}

/** La lectura cuyo horasDesdePublicacion esté más cerca de `horas`. Las que no traen horas no cuentan. */
export function lecturaMasCercana<T extends { horasDesdePublicacion: number | null }>(
  lecturas: readonly T[],
  horas: number,
): Cercana<T> | null {
  let mejor: Cercana<T> | null = null;
  let mejorDist = Infinity;
  for (const l of lecturas) {
    const h = l.horasDesdePublicacion;
    if (h === null) continue;
    const dist = Math.abs(h - horas);
    if (dist < mejorDist || (dist === mejorDist && mejor !== null && h < mejor.horasReales)) {
      mejor = { lectura: l, horasReales: h, aprox: dist > TOLERANCIA_HORAS };
      mejorDist = dist;
    }
  }
  return mejor;
}

/** La lectura más reciente (por fecha del dato). */
export function lecturaMasReciente<T extends { datoActualizadoEn: Date }>(lecturas: readonly T[]): T | null {
  let mejor: T | null = null;
  for (const l of lecturas) {
    if (mejor === null || l.datoActualizadoEn.getTime() > mejor.datoActualizadoEn.getTime()) mejor = l;
  }
  return mejor;
}

/** Qué fuente manda para las cifras de cada red. */
export function fuenteQueManda(red: Red): Fuente {
  return red === "tiktok" ? "zernio" : "meta";
}

export type Campo =
  | "vistas"
  | "meGusta"
  | "comentarios"
  | "compartidos"
  | "guardados"
  | "seguidoresGanados"
  | "tiempoPromedioS"
  | "pctCompleto"
  | "pctPasa3s";

export const CAMPOS: readonly Campo[] = [
  "vistas",
  "meGusta",
  "comentarios",
  "compartidos",
  "guardados",
  "seguidoresGanados",
  "tiempoPromedioS",
  "pctCompleto",
  "pctPasa3s",
];

export type CifrasResueltas = Record<Campo, Cifra> & {
  /** Horas reales de la lectura principal (null si no hay o es "última" sin horas). */
  horasReales: number | null;
  /** La lectura principal está a más de 12 h del objetivo. */
  aprox: boolean;
  /** Campos que salen de una lectura aproximada, con su hora real. */
  aproxHoras: Partial<Record<Campo, number>>;
};

interface Elegida {
  lectura: LecturaDato;
  horasReales: number | null;
  aprox: boolean;
}

function elegir(lecturas: readonly LecturaDato[], fuente: Fuente, objetivo: Objetivo): Elegida | null {
  const propias = lecturas.filter((l) => l.fuente === fuente);
  if (objetivo.tipo === "ultima") {
    const l = lecturaMasReciente(propias);
    return l ? { lectura: l, horasReales: l.horasDesdePublicacion, aprox: false } : null;
  }
  const c = lecturaMasCercana(propias, objetivo.horas);
  return c ? { lectura: c.lectura, horasReales: c.horasReales, aprox: c.aprox } : null;
}

const aCifra = (valor: number | null, l: LecturaDato | null): Cifra =>
  valor === null || l === null ? sinDato : { valor, fuente: l.fuente, datoActualizadoEn: l.datoActualizadoEn };

/** % que pasa del segundo 3 desde una lectura: ret3s directo, o 100 − pctSalta3s. */
function pasa3De(l: LecturaDato | null, modo: "ret3s" | "salta"): number | null {
  if (l === null) return null;
  if (modo === "ret3s") return l.ret3s;
  return l.pctSalta3s === null ? null : Math.round((100 - l.pctSalta3s) * 100) / 100;
}

/**
 * Las cifras de una publicación en un momento, con la fuente que manda en cada red:
 * - TikTok: todo de Zernio (pasa3 = ret3s).
 * - Instagram y Facebook: todo de Meta; pasa3 de Instagram = 100 − pctSalta3s de Zernio; el de Facebook queda sin dato.
 * - Una lectura manual solo entra donde la API no dio nada para ese momento, y se rotula "manual".
 */
export function cifrasDePublicacion(red: Red, lecturas: readonly LecturaDato[], objetivo: Objetivo): CifrasResueltas {
  const principal = elegir(lecturas, fuenteQueManda(red), objetivo);
  const manualElegida = elegir(lecturas, "manual", objetivo);
  // Una manual lejana del momento no sirve; en "última" vale la más reciente.
  const manual = manualElegida && !manualElegida.aprox ? manualElegida : null;
  const apiVale = principal !== null && !principal.aprox;

  const salida = {} as Record<Campo, Cifra>;
  const aproxHoras: Partial<Record<Campo, number>> = {};

  const campoDirecto = (campo: Exclude<Campo, "pctPasa3s">): Cifra => {
    const dePrincipal = principal ? principal.lectura[campo] : null;
    if (apiVale && dePrincipal !== null) return aCifra(dePrincipal, principal.lectura);
    const deManual = manual ? manual.lectura[campo] : null;
    if (deManual !== null) return aCifra(deManual, manual!.lectura);
    if (principal && dePrincipal !== null) {
      if (principal.horasReales !== null) aproxHoras[campo] = principal.horasReales;
      return aCifra(dePrincipal, principal.lectura);
    }
    return sinDato;
  };

  for (const campo of CAMPOS) {
    if (campo !== "pctPasa3s") salida[campo] = campoDirecto(campo);
  }

  // % que pasa del segundo 3: primero la API en su momento, luego la manual, y al final la API aproximada.
  let candidata: { cifra: Cifra; aproxH: number | null } | null = null;
  if (red === "tiktok") {
    const v = pasa3De(principal?.lectura ?? null, "ret3s");
    if (principal && v !== null) candidata = { cifra: aCifra(v, principal.lectura), aproxH: principal.aprox ? principal.horasReales : null };
  } else if (red === "instagram") {
    // Solo cuentan las lecturas de Zernio que traen el dato (a veces la última llega sin él).
    const z = elegir(lecturas.filter((l) => l.fuente !== "zernio" || l.pctSalta3s !== null), "zernio", objetivo);
    const v = pasa3De(z?.lectura ?? null, "salta");
    if (z && v !== null) candidata = { cifra: aCifra(v, z.lectura), aproxH: z.aprox ? z.horasReales : null };
  }
  let pasa3: Cifra = sinDato;
  if (candidata && candidata.aproxH === null) {
    pasa3 = candidata.cifra;
  } else {
    const vm = manual ? (manual.lectura.ret3s ?? pasa3De(manual.lectura, "salta")) : null;
    if (manual && vm !== null) {
      pasa3 = aCifra(vm, manual.lectura);
    } else if (candidata) {
      pasa3 = candidata.cifra;
      if (candidata.aproxH !== null) aproxHoras.pctPasa3s = candidata.aproxH;
    }
  }
  salida.pctPasa3s = pasa3;

  return {
    ...salida,
    horasReales: principal ? principal.horasReales : null,
    aprox: principal ? principal.aprox : false,
    aproxHoras,
  };
}

/** Columna "IG + FB": suma de las vistas de Meta de las dos. Si falta una (o no es de Meta), sin dato. */
export function sumaIgFb(ig: Cifra, fb: Cifra): Cifra {
  if (ig.valor === null || fb.valor === null) return sinDato;
  if (ig.fuente !== "meta" || fb.fuente !== "meta") return sinDato;
  const fechas = [ig.datoActualizadoEn, fb.datoActualizadoEn].filter((f): f is Date => f !== null);
  const masVieja = fechas.length ? new Date(Math.min(...fechas.map((f) => f.getTime()))) : null;
  return { valor: ig.valor + fb.valor, fuente: "meta", datoActualizadoEn: masVieja };
}
