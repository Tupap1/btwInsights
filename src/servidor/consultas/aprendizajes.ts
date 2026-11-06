// Pantalla /aprendizajes: compara grupos de reels (por gancho, formato, voz y variables probadas) con la
// mediana de lo que pasó a las 48 h. Solo medianas y conteos: sin significancia estadística inventada.
//
// Reglas:
// - Un "video" es la última publicación publicada de un reel en una red (igual que /videos).
// - Cuenta (n) solo si tiene lectura a 48 h válida: la más cercana a 48 h y a no más de 12 h (TOLERANCIA_HORAS).
// - Cada métrica toma la mediana de los videos que tienen ese dato; sin dato (null) no entra, nunca como 0.
//   Una métrica que sale de una lectura aproximada (otra fuente o lejana) tampoco entra.
// - Tiempo promedio como % = tiempoPromedioS / duración * 100. La duración es la del reel, o la de la publicación.
// - % que pasa del segundo 3: TikTok = ret3s; Instagram = 100 − pctSalta3s; Facebook = sin dato (lo resuelve cifras.ts).
// - Guardados + compartidos: la suma por video; si falta uno de los dos, ese video no entra.
// - Con n < 3 el grupo se marca "pocos datos" y la pantalla no muestra conclusión.
// - Variables probadas es texto libre: se parte por coma o punto y coma; cada pedazo recortado es un grupo
//   (sin distinguir mayúsculas) y el reel cuenta en todos los suyos. Los ganchos iguales (recortados, sin
//   distinguir mayúsculas) también se juntan. Un reel sin el atributo va al grupo "Sin dato".
import "server-only";
import type { BaseDeDatos } from "../db/cliente";
import type { Fuente, Red } from "../tipos";
import { OBJETIVO_48H, cifrasDePublicacion, type Cifra } from "./cifras";
import { cargarDatos, publicadasDeRed, REDES, type Datos, type ReelFila } from "./datos";
import { mediana } from "./estadistica";

export const MINIMO_VIDEOS = 3;
export const SIN_DATO = "Sin dato";

export const DIMENSIONES = ["gancho", "formato", "voz", "variables"] as const;
export type Dimension = (typeof DIMENSIONES)[number];

export interface MedianaGrupo {
  /** null = ningún video del grupo tiene el dato. */
  mediana: number | null;
  /** Cuántos videos aportaron el dato (≤ n). */
  conDato: number;
  /** De qué fuentes salió. */
  fuentes: Fuente[];
}

export interface CeldaGrupo {
  /** Videos con lectura válida a 48 h. */
  n: number;
  pocosDatos: boolean;
  vistas: MedianaGrupo;
  tiempoPct: MedianaGrupo;
  pasa3s: MedianaGrupo;
  guardadosCompartidos: MedianaGrupo;
}

export interface Grupo {
  clave: string;
  etiqueta: string;
  redes: Record<Red, CeldaGrupo>;
}

export type Aprendizajes = Record<Dimension, Grupo[]>;

/** Partes de "variablesProbadas": por coma o punto y coma, recortadas y sin vacías. */
export function dividirVariables(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter((x) => x !== "");
}

interface Muestra {
  vistas: Cifra;
  tiempoPct: number | null;
  tiempoFuente: Fuente | null;
  pasa3s: Cifra;
  guardadosCompartidos: number | null;
  gcFuentes: Fuente[];
}

/** Las cifras a 48 h de un video, o null si no tiene lectura válida a ese momento. */
function muestraDe(datos: Datos, reel: ReelFila, red: Red, pubId: number, duracionPub: number | null): Muestra | null {
  const res = cifrasDePublicacion(red, datos.lecturasPorPublicacion.get(pubId) ?? [], OBJETIVO_48H);
  if (res.horasReales === null || res.aprox) return null;
  const propia = <C extends "vistas" | "pctPasa3s" | "tiempoPromedioS" | "guardados" | "compartidos">(c: C): Cifra =>
    res.aproxHoras[c] === undefined ? res[c] : { valor: null, fuente: null, datoActualizadoEn: null };
  const duracion = reel.duracionS ?? duracionPub;
  const tiempo = propia("tiempoPromedioS");
  const guardados = propia("guardados");
  const compartidos = propia("compartidos");
  const gc = guardados.valor !== null && compartidos.valor !== null ? guardados.valor + compartidos.valor : null;
  return {
    vistas: propia("vistas"),
    tiempoPct: tiempo.valor !== null && duracion !== null && duracion > 0 ? (tiempo.valor / duracion) * 100 : null,
    tiempoFuente: tiempo.fuente,
    pasa3s: propia("pctPasa3s"),
    guardadosCompartidos: gc,
    gcFuentes: [guardados.fuente, compartidos.fuente].filter((f): f is Fuente => f !== null),
  };
}

function resumir(valores: (number | null)[], fuentes: (Fuente | null)[]): MedianaGrupo {
  const conDato = valores.filter((v) => v !== null).length;
  const unicas = [...new Set(fuentes.filter((f): f is Fuente => f !== null))].sort();
  return { mediana: mediana(valores), conDato, fuentes: conDato === 0 ? [] : unicas };
}

function celda(muestras: readonly Muestra[]): CeldaGrupo {
  const n = muestras.length;
  return {
    n,
    pocosDatos: n < MINIMO_VIDEOS,
    vistas: resumir(
      muestras.map((m) => m.vistas.valor),
      muestras.map((m) => m.vistas.fuente),
    ),
    tiempoPct: resumir(
      muestras.map((m) => m.tiempoPct),
      muestras.map((m) => (m.tiempoPct === null ? null : m.tiempoFuente)),
    ),
    pasa3s: resumir(
      muestras.map((m) => m.pasa3s.valor),
      muestras.map((m) => m.pasa3s.fuente),
    ),
    guardadosCompartidos: resumir(
      muestras.map((m) => m.guardadosCompartidos),
      muestras.flatMap((m) => (m.guardadosCompartidos === null ? [] : m.gcFuentes)),
    ),
  };
}

/** Los grupos (clave, etiqueta) a los que pertenece un reel en una dimensión. */
function gruposDe(reel: ReelFila, dim: Dimension): { clave: string; etiqueta: string }[] {
  const unico = (texto: string | null | undefined) => {
    const limpio = texto?.trim();
    return limpio ? [{ clave: limpio.toLowerCase(), etiqueta: limpio }] : [];
  };
  const lista =
    dim === "gancho"
      ? unico(reel.gancho)
      : dim === "formato"
        ? unico(reel.formato)
        : dim === "voz"
          ? unico(reel.voz)
          : dividirVariables(reel.variablesProbadas).map((v) => ({ clave: v.toLowerCase(), etiqueta: v }));
  const vistos = new Set<string>();
  const sinRepetir = lista.filter((g) => !vistos.has(g.clave) && !!vistos.add(g.clave));
  return sinRepetir.length > 0 ? sinRepetir : [{ clave: "sin-dato", etiqueta: SIN_DATO }];
}

/** Función pura: de los datos de la base a las tablas por dimensión, de más a menos videos. */
export function armarAprendizajes(datos: Datos): Aprendizajes {
  // Muestras por reel y red (la última publicada de cada red).
  const muestrasDeReel = new Map<string, Partial<Record<Red, Muestra>>>();
  for (const r of datos.reels) {
    const suyas = datos.publicaciones.filter((p) => p.reelId === r.id);
    const porRed: Partial<Record<Red, Muestra>> = {};
    for (const red of REDES) {
      const p = publicadasDeRed(suyas, red)[0];
      if (!p) continue;
      const m = muestraDe(datos, r, red, p.id, p.duracionS);
      if (m) porRed[red] = m;
    }
    muestrasDeReel.set(r.id, porRed);
  }

  const salida = { gancho: [], formato: [], voz: [], variables: [] } as Aprendizajes;
  for (const dim of DIMENSIONES) {
    const grupos = new Map<string, { etiqueta: string; porRed: Record<Red, Muestra[]> }>();
    for (const r of datos.reels) {
      const porRed = muestrasDeReel.get(r.id) ?? {};
      for (const g of gruposDe(r, dim)) {
        const actual = grupos.get(g.clave) ?? {
          etiqueta: g.etiqueta,
          porRed: { tiktok: [], instagram: [], facebook: [] } as Record<Red, Muestra[]>,
        };
        for (const red of REDES) {
          const m = porRed[red];
          if (m) actual.porRed[red].push(m);
        }
        grupos.set(g.clave, actual);
      }
    }
    salida[dim] = [...grupos.entries()]
      .filter(([, g]) => REDES.some((red) => g.porRed[red].length > 0))
      .map(([clave, g]) => ({
        clave,
        etiqueta: g.etiqueta,
        redes: {
          tiktok: celda(g.porRed.tiktok),
          instagram: celda(g.porRed.instagram),
          facebook: celda(g.porRed.facebook),
        },
      }))
      .sort((a, b) => {
        const na = REDES.reduce((s, r) => s + a.redes[r].n, 0);
        const nb = REDES.reduce((s, r) => s + b.redes[r].n, 0);
        return nb - na || a.etiqueta.localeCompare(b.etiqueta, "es");
      });
  }
  return salida;
}

export async function consultarAprendizajes(db: BaseDeDatos): Promise<Aprendizajes> {
  return armarAprendizajes(await cargarDatos(db));
}
