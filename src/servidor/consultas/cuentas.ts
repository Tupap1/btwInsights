// Seguidores por red desde `cuenta_lectura`: la serie en el tiempo, la última cifra y los seguidores nuevos de /hoy.
// Regla de los datos: solo lo que se leyó. Sin interpolar; con menos de dos lecturas en la ventana, null.
import "server-only";
import type { BaseDeDatos } from "../db/cliente";
import { cuentaLectura } from "../db/esquema";
import type { Fuente, Red } from "../tipos";
import { fuenteQueManda, sinDato, type Cifra } from "./cifras";
import { REDES } from "./datos";

export interface LecturaCuenta {
  red: Red;
  cuenta: string;
  fuente: Fuente;
  leidoEn: Date;
  seguidores: number | null;
}

export interface PuntoSeguidores {
  leidoEn: Date;
  seguidores: number;
  fuente: Fuente;
  cuenta: string;
}

export interface SerieSeguidores {
  red: Red;
  fuente: Fuente;
  puntos: PuntoSeguidores[];
}

const FUENTES: readonly Fuente[] = ["meta", "zernio", "manual"];

type ConDato = LecturaCuenta & { seguidores: number };
const conDato = (l: LecturaCuenta): l is ConDato => l.seguidores !== null;
const masReciente = (a: ConDato, b: ConDato) => b.leidoEn.getTime() - a.leidoEn.getTime();

/**
 * Seguidores nuevos en la ventana [desde, hasta): la última lectura menos la primera dentro de la ventana, de la
 * misma red, cuenta y fuente. La cuenta es la de la lectura más reciente de la ventana. Con menos de dos lecturas,
 * sin dato: no se interpola ni se usa una lectura de fuera de la ventana.
 */
export function seguidoresNuevos(
  lecturas: readonly LecturaCuenta[],
  red: Red,
  fuente: Fuente,
  desde: Date,
  hasta: Date,
): Cifra {
  const dentro = lecturas
    .filter(conDato)
    .filter((l) => l.red === red && l.fuente === fuente && l.leidoEn >= desde && l.leidoEn < hasta)
    .sort(masReciente);
  const ultima = dentro[0];
  if (!ultima) return sinDato;
  const deLaCuenta = dentro.filter((l) => l.cuenta === ultima.cuenta);
  const primera = deLaCuenta[deLaCuenta.length - 1];
  if (!primera || deLaCuenta.length < 2) return sinDato;
  return { valor: ultima.seguidores - primera.seguidores, fuente, datoActualizadoEn: ultima.leidoEn };
}

/** Una serie por red y fuente (en el orden de las redes), con los puntos que existen ordenados por fecha. */
export function serieSeguidores(lecturas: readonly LecturaCuenta[]): SerieSeguidores[] {
  const series: SerieSeguidores[] = [];
  for (const red of REDES) {
    for (const fuente of FUENTES) {
      const puntos = lecturas
        .filter(conDato)
        .filter((l) => l.red === red && l.fuente === fuente)
        .sort((a, b) => a.leidoEn.getTime() - b.leidoEn.getTime())
        .map((l) => ({ leidoEn: l.leidoEn, seguidores: l.seguidores, fuente: l.fuente, cuenta: l.cuenta }));
      if (puntos.length > 0) series.push({ red, fuente, puntos });
    }
  }
  return series;
}

/**
 * La última cifra de cada red: de la fuente que manda; si esa no tiene nada, la más reciente de otra fuente (con su
 * propia fuente a la vista). Sin ninguna lectura, sin dato.
 */
export function ultimaPorRed(lecturas: readonly LecturaCuenta[]): Record<Red, Cifra> {
  const de = (l: ConDato | undefined): Cifra =>
    l ? { valor: l.seguidores, fuente: l.fuente, datoActualizadoEn: l.leidoEn } : sinDato;
  const r = {} as Record<Red, Cifra>;
  for (const red of REDES) {
    const deRed = lecturas.filter(conDato).filter((l) => l.red === red).sort(masReciente);
    r[red] = de(deRed.find((l) => l.fuente === fuenteQueManda(red)) ?? deRed[0]);
  }
  return r;
}

export interface Cuentas {
  lecturas: LecturaCuenta[];
  series: SerieSeguidores[];
  ultima: Record<Red, Cifra>;
}

export async function cargarLecturasCuenta(db: BaseDeDatos): Promise<LecturaCuenta[]> {
  return db
    .select({
      red: cuentaLectura.red,
      cuenta: cuentaLectura.cuenta,
      fuente: cuentaLectura.fuente,
      leidoEn: cuentaLectura.leidoEn,
      seguidores: cuentaLectura.seguidores,
    })
    .from(cuentaLectura);
}

export async function consultarCuentas(db: BaseDeDatos): Promise<Cuentas> {
  const lecturas = await cargarLecturasCuenta(db);
  return { lecturas, series: serieSeguidores(lecturas), ultima: ultimaPorRed(lecturas) };
}
