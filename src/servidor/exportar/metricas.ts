// Exportación de métricas para btw-videos (GET /api/exportar/metricas.csv).
// Una fila por publicación y fuente, con la última lectura de esa fuente (datoActualizadoEn más reciente).
// Una publicación sin lecturas sale en una fila con las cifras vacías. null = celda vacía (nunca 0).
// CSV según RFC 4180: UTF-8, separador coma, saltos CRLF, celdas con coma, comilla o salto entre comillas.
// Las fechas van en ISO 8601 con zona (UTC, "Z"); la hora de Bogotá es UTC−5 y quien lea la convierte.
import "server-only";
import { asc } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { lectura, publicacion } from "../db/esquema";
import type { Fuente, Red, Via } from "../tipos";
import { lecturaMasReciente } from "../consultas/cifras";

export interface PublicacionExport {
  id: number;
  reelId: string | null;
  red: Red;
  cuenta: string | null;
  estado: string;
  enlace: string | null;
  publicadoEn: Date | null;
}

export interface LecturaExport {
  publicacionId: number;
  fuente: Fuente;
  via: Via;
  leidoEn: Date;
  datoActualizadoEn: Date;
  horasDesdePublicacion: number | null;
  vistas: number | null;
  alcance: number | null;
  meGusta: number | null;
  comentarios: number | null;
  compartidos: number | null;
  guardados: number | null;
  tiempoPromedioS: number | null;
  pctCompleto: number | null;
  pctSalta3s: number | null;
  ret3s: number | null;
  seguidoresGanados: number | null;
}

export const COLUMNAS = [
  "reel",
  "red",
  "cuenta",
  "estado",
  "enlace",
  "publicadoEn",
  "fuente",
  "via",
  "datoActualizadoEn",
  "leidoEn",
  "horasDesdePublicacion",
  "vistas",
  "alcance",
  "meGusta",
  "comentarios",
  "compartidos",
  "guardados",
  "tiempoPromedioS",
  "pctCompleto",
  "pctSalta3s",
  "ret3s",
  "seguidoresGanados",
] as const;

export type Columna = (typeof COLUMNAS)[number];
export type FilaMetricas = Record<Columna, string | number | Date | null>;

const ORDEN_FUENTES: readonly Fuente[] = ["meta", "zernio", "manual"];

const CIFRAS_VACIAS = {
  fuente: null,
  via: null,
  datoActualizadoEn: null,
  leidoEn: null,
  horasDesdePublicacion: null,
  vistas: null,
  alcance: null,
  meGusta: null,
  comentarios: null,
  compartidos: null,
  guardados: null,
  tiempoPromedioS: null,
  pctCompleto: null,
  pctSalta3s: null,
  ret3s: null,
  seguidoresGanados: null,
} as const;

/** Las filas: por publicación (en el orden recibido) y fuente (meta, zernio, manual). */
export function armarFilasMetricas(
  publicaciones: readonly PublicacionExport[],
  lecturas: readonly LecturaExport[],
): FilaMetricas[] {
  const porPublicacion = new Map<number, LecturaExport[]>();
  for (const l of lecturas) {
    const lista = porPublicacion.get(l.publicacionId) ?? [];
    lista.push(l);
    porPublicacion.set(l.publicacionId, lista);
  }
  const filas: FilaMetricas[] = [];
  for (const p of publicaciones) {
    const base = {
      reel: p.reelId,
      red: p.red,
      cuenta: p.cuenta,
      estado: p.estado,
      enlace: p.enlace,
      publicadoEn: p.publicadoEn,
    };
    const suyas = porPublicacion.get(p.id) ?? [];
    const ultimas = ORDEN_FUENTES.flatMap((f) => {
      const l = lecturaMasReciente(suyas.filter((x) => x.fuente === f));
      return l ? [l] : [];
    });
    if (ultimas.length === 0) {
      filas.push({ ...base, ...CIFRAS_VACIAS });
      continue;
    }
    for (const l of ultimas) {
      filas.push({
        ...base,
        fuente: l.fuente,
        via: l.via,
        datoActualizadoEn: l.datoActualizadoEn,
        leidoEn: l.leidoEn,
        horasDesdePublicacion: l.horasDesdePublicacion,
        vistas: l.vistas,
        alcance: l.alcance,
        meGusta: l.meGusta,
        comentarios: l.comentarios,
        compartidos: l.compartidos,
        guardados: l.guardados,
        tiempoPromedioS: l.tiempoPromedioS,
        pctCompleto: l.pctCompleto,
        pctSalta3s: l.pctSalta3s,
        ret3s: l.ret3s,
        seguidoresGanados: l.seguidoresGanados,
      });
    }
  }
  return filas;
}

/** Una celda: null vacío, fechas ISO, y entre comillas si trae coma, comilla o salto de línea. */
export function escaparCelda(valor: string | number | Date | null): string {
  if (valor === null) return "";
  const texto = valor instanceof Date ? valor.toISOString() : String(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

/** El CSV completo: encabezado y una línea por fila, todas terminadas en CRLF. */
export function aCsv(filas: readonly FilaMetricas[]): string {
  const lineas = [COLUMNAS.join(","), ...filas.map((f) => COLUMNAS.map((c) => escaparCelda(f[c])).join(","))];
  return lineas.join("\r\n") + "\r\n";
}

export async function csvDeMetricas(db: BaseDeDatos): Promise<string> {
  const [publicaciones, lecturas] = await Promise.all([
    db.select().from(publicacion).orderBy(asc(publicacion.id)),
    db.select().from(lectura).orderBy(asc(lectura.datoActualizadoEn)),
  ]);
  return aCsv(armarFilasMetricas(publicaciones, lecturas));
}
