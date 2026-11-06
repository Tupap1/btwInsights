// Pantalla /videos: una fila por reel, cifras por red en el momento elegido, colores contra la mediana de los
// últimos 10 de la misma red y columna "IG + FB".
import "server-only";
import { z } from "zod";
import type { BaseDeDatos } from "../db/cliente";
import type { Red } from "../tipos";
import {
  OBJETIVO_48H,
  OBJETIVO_7D,
  OBJETIVO_ULTIMA,
  cifrasDePublicacion,
  sinDato,
  sumaIgFb,
  type Cifra,
  type Objetivo,
} from "./cifras";
import { cargarDatos, estaPublicada, publicadasDeRed, REDES, type ReelFila } from "./datos";
import { compararConMediana, mediana, type Comparacion } from "./estadistica";
import { diaBogota } from "./tiempo";

export const MOMENTOS = ["48h", "7d", "ultima"] as const;
export type Momento = (typeof MOMENTOS)[number];
export const OBJETIVO_DE_MOMENTO: Record<Momento, Objetivo> = {
  "48h": OBJETIVO_48H,
  "7d": OBJETIVO_7D,
  ultima: OBJETIVO_ULTIMA,
};

export const METRICAS_VIDEOS = ["vistas", "tiempoPromedioS", "pctCompleto", "pctPasa3s"] as const;
export type MetricaVideos = (typeof METRICAS_VIDEOS)[number];

export const FORMATOS = ["la_cuenta", "dialogo", "prueba_real", "plata_3d", "pantalla_dividida", "otro"] as const;
export const VOCES = ["fernando", "andres", "andres_voice_changer", "sin_voz", "otra"] as const;

const CLAVES_ORDEN = [
  "fecha",
  "gancho",
  "formato",
  "voz",
  "igfb",
  ...REDES.flatMap((r) => METRICAS_VIDEOS.map((m) => `${r}_${m}` as const)),
] as const;
export type ClaveOrden = (typeof CLAVES_ORDEN)[number];

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const primero = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export interface FiltrosVideos {
  momento: Momento;
  formato: (typeof FORMATOS)[number] | undefined;
  voz: (typeof VOCES)[number] | undefined;
  red: Red | undefined;
  desde: string | undefined;
  hasta: string | undefined;
  orden: ClaveOrden;
  dir: "asc" | "desc";
}

/** Lee los filtros de la URL. Lo que no sirve se descarta (una URL rara nunca rompe la pantalla). */
export function leerFiltros(crudo: Record<string, string | string[] | undefined>): FiltrosVideos {
  const leer = <T extends z.ZodType>(esquema: T, nombre: string): z.infer<T> | undefined => {
    const r = esquema.safeParse(primero(crudo[nombre]));
    return r.success ? r.data : undefined;
  };
  return {
    momento: leer(z.enum(MOMENTOS), "momento") ?? "ultima",
    formato: leer(z.enum(FORMATOS), "formato"),
    voz: leer(z.enum(VOCES), "voz"),
    red: leer(z.enum(["tiktok", "instagram", "facebook"]), "red"),
    desde: leer(dia, "desde"),
    hasta: leer(dia, "hasta"),
    orden: leer(z.enum(CLAVES_ORDEN), "orden") ?? "fecha",
    dir: leer(z.enum(["asc", "desc"]), "dir") ?? "desc",
  };
}

export interface CeldaRed {
  publicacionId: number;
  enlace: string | null;
  cifras: Record<MetricaVideos, Cifra>;
  /** Horas reales de las cifras que salen de una lectura a más de 12 h del momento pedido. */
  aproxHoras: Partial<Record<MetricaVideos, number>>;
  comparacion: Record<MetricaVideos, Comparacion>;
}

export interface FilaVideo {
  reel: ReelFila;
  /** Día de Bogotá en que salió (o el del plan). */
  fecha: string | null;
  /** Ya salió en alguna red (si no, la fecha es la del plan o no hay). */
  publicado: boolean;
  redes: Record<Red, CeldaRed | null>;
  igfb: Cifra;
}

export interface ResultadoVideos {
  filas: FilaVideo[];
  filtros: FiltrosVideos;
  /** Reels que hay en total antes de filtrar. */
  total: number;
}

type Medianas = Record<Red, Record<MetricaVideos, number | null>>;

export async function consultarVideos(db: BaseDeDatos, filtros: FiltrosVideos): Promise<ResultadoVideos> {
  const datos = await cargarDatos(db);
  const objetivo = OBJETIVO_DE_MOMENTO[filtros.momento];

  // Mediana de los últimos 10 publicados de cada red, en el mismo momento. Las cifras aproximadas no entran.
  const vacia = (): Record<MetricaVideos, number | null> => ({
    vistas: null,
    tiempoPromedioS: null,
    pctCompleto: null,
    pctPasa3s: null,
  });
  const medianas: Medianas = { tiktok: vacia(), instagram: vacia(), facebook: vacia() };
  for (const red of REDES) {
    const ultimos = publicadasDeRed(datos.publicaciones, red).slice(0, 10);
    const resueltas = ultimos.map((p) =>
      cifrasDePublicacion(red, datos.lecturasPorPublicacion.get(p.id) ?? [], objetivo),
    );
    for (const m of METRICAS_VIDEOS) {
      medianas[red][m] = mediana(resueltas.map((r) => (r.aproxHoras[m] === undefined ? r[m].valor : null)));
    }
  }

  const filas: FilaVideo[] = datos.reels.map((r) => {
    const suyas = datos.publicaciones.filter((p) => p.reelId === r.id);
    const redes: Record<Red, CeldaRed | null> = { tiktok: null, instagram: null, facebook: null };
    for (const red of REDES) {
      const p = publicadasDeRed(suyas, red)[0];
      if (!p) continue;
      const res = cifrasDePublicacion(red, datos.lecturasPorPublicacion.get(p.id) ?? [], objetivo);
      const cifras = {} as Record<MetricaVideos, Cifra>;
      const aproxHoras: Partial<Record<MetricaVideos, number>> = {};
      const comparacion = {} as Record<MetricaVideos, Comparacion>;
      for (const m of METRICAS_VIDEOS) {
        cifras[m] = res[m];
        const h = res.aproxHoras[m];
        if (h !== undefined) aproxHoras[m] = h;
        comparacion[m] =
          h === undefined ? compararConMediana(cifras[m].valor, medianas[red][m]) : { tono: null, atipico: false };
      }
      redes[red] = { publicacionId: p.id, enlace: p.enlace, cifras, aproxHoras, comparacion };
    }
    const salidas = suyas.filter(estaPublicada).map((p) => p.publicadoEn.getTime());
    const programadas = suyas.flatMap((p) => (p.programadoPara ? [p.programadoPara.getTime()] : []));
    const primera = salidas.length ? Math.min(...salidas) : programadas.length ? Math.min(...programadas) : null;
    const fecha = primera !== null ? diaBogota(new Date(primera)) : r.fechaPlan;
    const igfb =
      redes.instagram && redes.facebook ? sumaIgFb(redes.instagram.cifras.vistas, redes.facebook.cifras.vistas) : sinDato;
    return { reel: r, fecha, publicado: salidas.length > 0, redes, igfb };
  });

  const total = filas.length;
  const visibles = filas.filter((f) => {
    if (filtros.formato && f.reel.formato !== filtros.formato) return false;
    if (filtros.voz && f.reel.voz !== filtros.voz) return false;
    if (filtros.red && f.redes[filtros.red] === null) return false;
    if (filtros.desde && (f.fecha === null || f.fecha < filtros.desde)) return false;
    if (filtros.hasta && (f.fecha === null || f.fecha > filtros.hasta)) return false;
    return true;
  });
  return { filas: ordenar(visibles, filtros.orden, filtros.dir === "asc" ? 1 : -1), filtros, total };
}

function valorOrden(f: FilaVideo, clave: ClaveOrden): string | number | null {
  switch (clave) {
    case "fecha":
      return f.fecha;
    case "gancho":
      return f.reel.gancho?.toLowerCase() ?? null;
    case "formato":
      return f.reel.formato;
    case "voz":
      return f.reel.voz;
    case "igfb":
      return f.igfb.valor;
    default: {
      const [red, metrica] = clave.split("_") as [Red, MetricaVideos];
      return f.redes[red]?.cifras[metrica].valor ?? null;
    }
  }
}

/** Orden por cualquier columna; lo que no tiene dato va siempre al final. */
export function ordenar(filas: readonly FilaVideo[], clave: ClaveOrden, signo: 1 | -1): FilaVideo[] {
  return [...filas].sort((a, b) => {
    // Por fecha, lo que aún no salió va al final en cualquier sentido.
    if (clave === "fecha" && a.publicado !== b.publicado) return a.publicado ? -1 : 1;
    const va = valorOrden(a, clave);
    const vb = valorOrden(b, clave);
    const desempate = a.reel.id.localeCompare(b.reel.id, "es", { numeric: true });
    if (va === null && vb === null) return desempate;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va < vb) return -1 * signo;
    if (va > vb) return 1 * signo;
    return desempate;
  });
}
