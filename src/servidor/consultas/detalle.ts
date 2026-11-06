// Pantalla /videos/[id]: todo lo de un reel. Curvas con los puntos que existen, sin interpolar.
import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { curvaRetencion } from "../db/esquema";
import type { Fuente, Red } from "../tipos";
import {
  OBJETIVO_48H,
  OBJETIVO_7D,
  OBJETIVO_ULTIMA,
  cifrasDePublicacion,
  fuenteQueManda,
  lecturaMasCercana,
  lecturaMasReciente,
  sinDato,
  type Cifra,
  type CifrasResueltas,
  type LecturaDato,
} from "./cifras";
import { cargarDatos, NOMBRE_RED, publicadasDeRed, REDES, type PublicacionFila, type ReelFila } from "./datos";
import { mediana } from "./estadistica";

export interface DetallePublicacion {
  publicacion: PublicacionFila;
  ultima: CifrasResueltas;
  h48: CifrasResueltas;
  d7: CifrasResueltas;
}

export type FilaCrecimiento = { horas: number } & Record<string, number | null>;

export interface SerieCrecimiento {
  clave: string;
  nombre: string;
  red: Red;
  tipo: "real" | "mediana";
}

export interface PuntoRetencion {
  segundo: number;
  pct: number | null;
  mejor: number | null;
}

export interface Retencion {
  puntos: PuntoRetencion[];
  fuente: Fuente;
  datoActualizadoEn: Date;
  mejor: { reelId: string; gancho: string | null } | null;
}

export interface Trafico {
  paraTi: Cifra;
  busqueda: Cifra;
  noSeguidores: Cifra;
  pais: string | null;
  paisPct: Cifra;
}

export interface Detalle {
  reel: ReelFila;
  publicaciones: DetallePublicacion[];
  crecimiento: { filas: FilaCrecimiento[]; series: SerieCrecimiento[] };
  retencion: Retencion | null;
  trafico: Trafico | null;
}

/** Horas en que se saca la mediana de los últimos 10: cada una con las lecturas a ±12 h. */
export const HORAS_MEDIANA = [24, 48, 72, 96, 120, 144, 168] as const;
/** Menos videos que esto y la mediana no dice nada. */
export const MINIMO_PARA_MEDIANA = 3;

/** Junta series sueltas en filas por hora, para la gráfica. Un hueco queda en null (no se rellena). */
export function armarFilasCrecimiento(series: Record<string, { horas: number; valor: number }[]>): FilaCrecimiento[] {
  const claves = Object.keys(series);
  const horas = [...new Set(claves.flatMap((c) => (series[c] ?? []).map((p) => p.horas)))].sort((a, b) => a - b);
  return horas.map((h) => {
    const fila: FilaCrecimiento = { horas: h };
    for (const c of claves) fila[c] = (series[c] ?? []).find((p) => p.horas === h)?.valor ?? null;
    return fila;
  });
}

const puntosDeVistas = (ls: readonly LecturaDato[]): { horas: number; valor: number }[] => {
  const porHora = new Map<number, { horas: number; valor: number; en: number }>();
  for (const l of ls) {
    if (l.horasDesdePublicacion === null || l.vistas === null) continue;
    const previo = porHora.get(l.horasDesdePublicacion);
    if (!previo || l.datoActualizadoEn.getTime() > previo.en) {
      porHora.set(l.horasDesdePublicacion, { horas: l.horasDesdePublicacion, valor: l.vistas, en: l.datoActualizadoEn.getTime() });
    }
  }
  return [...porHora.values()].sort((a, b) => a.horas - b.horas).map(({ horas, valor }) => ({ horas, valor }));
};

const promedio = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0) / v.length;

export async function consultarDetalle(db: BaseDeDatos, reelId: string): Promise<Detalle | null> {
  const datos = await cargarDatos(db);
  const reel = datos.reels.find((r) => r.id === reelId);
  if (!reel) return null;
  const lecturasDe = (id: number): LecturaDato[] => datos.lecturasPorPublicacion.get(id) ?? [];
  const suyas = datos.publicaciones.filter((p) => p.reelId === reel.id);

  const publicaciones: DetallePublicacion[] = REDES.flatMap((red) =>
    suyas
      .filter((p) => p.red === red)
      .map((p) => ({
        publicacion: p,
        ultima: cifrasDePublicacion(red, lecturasDe(p.id), OBJETIVO_ULTIMA),
        h48: cifrasDePublicacion(red, lecturasDe(p.id), OBJETIVO_48H),
        d7: cifrasDePublicacion(red, lecturasDe(p.id), OBJETIVO_7D),
      })),
  );

  // Curva de crecimiento: una línea por red (de la fuente que manda) y la mediana de los últimos 10 de esa red.
  const series: SerieCrecimiento[] = [];
  const crudas: Record<string, { horas: number; valor: number }[]> = {};
  for (const red of REDES) {
    const suya = publicadasDeRed(suyas, red)[0];
    if (!suya) continue;
    const delaFuente = (id: number) => lecturasDe(id).filter((l) => l.fuente === fuenteQueManda(red));
    const puntos = puntosDeVistas(delaFuente(suya.id));
    if (puntos.length > 0) {
      series.push({ clave: red, nombre: NOMBRE_RED[red], red, tipo: "real" });
      crudas[red] = puntos;
    }
    const otros = publicadasDeRed(datos.publicaciones, red)
      .filter((p) => p.id !== suya.id)
      .slice(0, 10);
    const puntosMediana: { horas: number; valor: number }[] = [];
    for (const h of HORAS_MEDIANA) {
      const valores: number[] = [];
      for (const o of otros) {
        const c = lecturaMasCercana(delaFuente(o.id).filter((l) => l.vistas !== null), h);
        if (c && !c.aprox && c.lectura.vistas !== null) valores.push(c.lectura.vistas);
      }
      const m = valores.length >= MINIMO_PARA_MEDIANA ? mediana(valores) : null;
      if (m !== null) puntosMediana.push({ horas: h, valor: m });
    }
    if (puntosMediana.length > 0 && puntos.length > 0) {
      series.push({ clave: `mediana_${red}`, nombre: `Mediana ${NOMBRE_RED[red]} (últimos 10)`, red, tipo: "mediana" });
      crudas[`mediana_${red}`] = puntosMediana;
    }
  }

  // Retención de TikTok contra la mejor curva del mismo formato.
  let retencion: Retencion | null = null;
  const tiktok = publicadasDeRed(suyas, "tiktok")[0];
  if (tiktok) {
    const curvas = await db
      .select()
      .from(curvaRetencion)
      .where(eq(curvaRetencion.publicacionId, tiktok.id))
      .orderBy(desc(curvaRetencion.datoActualizadoEn))
      .limit(1);
    const curva = curvas[0];
    if (curva) {
      let mejor: { reelId: string; gancho: string | null; puntos: Record<string, number> } | null = null;
      if (reel.formato) {
        const hermanas = datos.publicaciones.filter(
          (p) =>
            p.red === "tiktok" &&
            p.reelId !== null &&
            p.reelId !== reel.id &&
            datos.reels.find((r) => r.id === p.reelId)?.formato === reel.formato,
        );
        const otras = hermanas.length
          ? await db
              .select()
              .from(curvaRetencion)
              .where(inArray(curvaRetencion.publicacionId, hermanas.map((p) => p.id)))
          : [];
        // La mejor = la de mayor retención promedio. De cada publicación cuenta su curva más reciente.
        const recientes = new Map<number, (typeof otras)[number]>();
        for (const o of otras) {
          const previa = recientes.get(o.publicacionId);
          if (!previa || o.datoActualizadoEn > previa.datoActualizadoEn) recientes.set(o.publicacionId, o);
        }
        let mejorProm = -Infinity;
        for (const o of recientes.values()) {
          const valores = Object.values(o.puntos);
          if (valores.length === 0) continue;
          const prom = promedio(valores);
          const reelDe = hermanas.find((p) => p.id === o.publicacionId)?.reelId;
          if (prom > mejorProm && reelDe) {
            mejorProm = prom;
            mejor = { reelId: reelDe, gancho: datos.reels.find((r) => r.id === reelDe)?.gancho ?? null, puntos: o.puntos };
          }
        }
      }
      const segundos = [
        ...new Set([...Object.keys(curva.puntos), ...Object.keys(mejor?.puntos ?? {})].map(Number).filter(Number.isFinite)),
      ].sort((a, b) => a - b);
      retencion = {
        puntos: segundos.map((s) => ({
          segundo: s,
          pct: curva.puntos[String(s)] ?? null,
          mejor: mejor?.puntos[String(s)] ?? null,
        })),
        fuente: curva.fuente,
        datoActualizadoEn: curva.datoActualizadoEn,
        mejor: mejor ? { reelId: mejor.reelId, gancho: mejor.gancho } : null,
      };
    }
  }

  // Tráfico, no seguidores y país: de la lectura más reciente de Zernio en TikTok.
  let trafico: Trafico | null = null;
  if (tiktok) {
    const z = lecturaMasReciente(lecturasDe(tiktok.id).filter((l) => l.fuente === "zernio"));
    if (z) {
      const aCifra = (v: number | null): Cifra =>
        v === null ? sinDato : { valor: v, fuente: "zernio", datoActualizadoEn: z.datoActualizadoEn };
      trafico = {
        paraTi: aCifra(z.pctParaTi),
        busqueda: aCifra(z.pctBusqueda),
        noSeguidores: aCifra(z.pctNoSeguidores),
        pais: z.paisPrincipal ?? null,
        paisPct: aCifra(z.paisPrincipalPct ?? null),
      };
    }
  }

  return {
    reel,
    publicaciones,
    crecimiento: { filas: armarFilasCrecimiento(crudas), series },
    retencion,
    trafico,
  };
}
