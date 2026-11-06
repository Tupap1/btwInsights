// Editar un borrador de Zernio (T15): revisar (no escribe nada) y guardar (PUT a Zernio y luego la base).
// Solo TikTok e Instagram, solo publicaciones de origen Zernio en estado borrador y con zernioPostId.
// Lo único que se cambia: el texto y la fecha. Nunca se programa ni se publica (el cliente fija isDraft: true).
import "server-only";
import { eq } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { publicacion } from "../db/esquema";
import { formatoFechaHora } from "../consultas/formato";
import type { ClienteZernioCompleto } from "../fuentes/zernio";
import type { Red } from "../tipos";

/** Error con un mensaje apto para mostrarse tal cual al usuario (en español, sin llaves ni detalles de red). */
export class ErrorEdicion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorEdicion";
  }
}

export interface EntradaEdicion {
  publicacionId: number;
  texto?: string;
  programadoPara?: Date;
}

export interface CambioResumen {
  campo: "Texto" | "Fecha y hora";
  antes: string;
  despues: string;
}

export interface ResumenEdicion {
  red: string;
  cambios: CambioResumen[];
  /** Fecha y hora de Bogotá en que quedará el borrador, o null si no tiene fecha. */
  paraCuando: string | null;
}

const NOMBRE: Record<Red, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };
const SIN_DATO = "sin dato";

/** "AAAA-MM-DD" + "HH:MM" de Bogotá (UTC-5, sin horario de verano) a un Date. null si no es una fecha real. */
export function fechaBogotaADate(dia: string, hora: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  const h = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!d || !h) return null;
  const [anio, mes, diaNum] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hh, mm] = [Number(h[1]), Number(h[2])];
  if (hh > 23 || mm > 59) return null;
  const utc = new Date(Date.UTC(anio, mes - 1, diaNum, hh + 5, mm));
  // Si el día no existe (30 de febrero), Date lo desborda al mes siguiente: se detecta comparando.
  const control = new Date(utc.getTime() - 5 * 3_600_000);
  if (control.getUTCFullYear() !== anio || control.getUTCMonth() !== mes - 1 || control.getUTCDate() !== diaNum) return null;
  return utc;
}

/** Resumen de confirmación. Pura. Solo lista lo que de verdad cambia. */
export function armarResumen(
  red: Red,
  antes: { texto: string | null; programadoPara: Date | null },
  despues: { texto?: string; programadoPara?: Date },
): ResumenEdicion {
  const cambios: CambioResumen[] = [];
  if (despues.texto !== undefined && despues.texto !== antes.texto) {
    cambios.push({ campo: "Texto", antes: antes.texto ?? SIN_DATO, despues: despues.texto });
  }
  if (despues.programadoPara !== undefined && despues.programadoPara.getTime() !== antes.programadoPara?.getTime()) {
    cambios.push({
      campo: "Fecha y hora",
      antes: antes.programadoPara ? formatoFechaHora(antes.programadoPara) : SIN_DATO,
      despues: formatoFechaHora(despues.programadoPara),
    });
  }
  const fecha = despues.programadoPara ?? antes.programadoPara;
  return { red: NOMBRE[red], cambios, paraCuando: fecha ? formatoFechaHora(fecha) : null };
}

interface Validada {
  zernioPostId: string;
  red: Red;
  texto?: string;
  programadoPara?: Date;
  resumen: ResumenEdicion;
}

async function validar(db: BaseDeDatos, e: EntradaEdicion, ahora: Date): Promise<Validada> {
  const [p] = await db.select().from(publicacion).where(eq(publicacion.id, e.publicacionId));
  if (!p) throw new ErrorEdicion("Esa publicación no existe.");
  if (p.red === "facebook") throw new ErrorEdicion("Facebook solo se edita en Meta Business Suite.");
  if (p.origen !== "zernio" || p.estado !== "borrador" || !p.zernioPostId) {
    throw new ErrorEdicion("Solo se pueden editar borradores de Zernio.");
  }
  const texto = e.texto;
  if (texto !== undefined && texto.trim() === "") throw new ErrorEdicion("El texto no puede quedar vacío.");
  const fecha = e.programadoPara;
  if (fecha !== undefined) {
    if (!Number.isFinite(fecha.getTime())) throw new ErrorEdicion("La fecha no es válida.");
    if (fecha.getTime() <= ahora.getTime()) throw new ErrorEdicion("La fecha debe ser futura.");
  }
  const resumen = armarResumen(p.red, p, {
    ...(texto !== undefined ? { texto } : {}),
    ...(fecha !== undefined ? { programadoPara: fecha } : {}),
  });
  if (resumen.cambios.length === 0) throw new ErrorEdicion("No hay cambios que guardar.");
  const salida: Validada = { zernioPostId: p.zernioPostId, red: p.red, resumen };
  if (resumen.cambios.some((c) => c.campo === "Texto") && texto !== undefined) salida.texto = texto;
  if (resumen.cambios.some((c) => c.campo === "Fecha y hora") && fecha !== undefined) salida.programadoPara = fecha;
  return salida;
}

/** Paso 1: revisa y devuelve el resumen. No escribe en ningún lado. */
export async function revisarEdicion(db: BaseDeDatos, e: EntradaEdicion, ahora: Date): Promise<ResumenEdicion> {
  return (await validar(db, e, ahora)).resumen;
}

/** Paso 2: manda el cambio a Zernio y, solo si responde bien, actualiza texto y fecha en la base. */
export async function guardarEdicion(
  db: BaseDeDatos,
  e: EntradaEdicion,
  zernio: Pick<ClienteZernioCompleto, "editarBorrador">,
  ahora: Date,
): Promise<ResumenEdicion> {
  const v = await validar(db, e, ahora);
  try {
    await zernio.editarBorrador(v.zernioPostId, {
      ...(v.texto !== undefined ? { contenido: v.texto } : {}),
      ...(v.programadoPara !== undefined ? { programadoPara: v.programadoPara } : {}),
    });
  } catch {
    // El detalle (con la llave ya redactada) no sale: el usuario ve un mensaje genérico.
    throw new ErrorEdicion("Zernio no aceptó el cambio. No se guardó nada.");
  }
  await db
    .update(publicacion)
    .set({
      ...(v.texto !== undefined ? { texto: v.texto } : {}),
      ...(v.programadoPara !== undefined ? { programadoPara: v.programadoPara } : {}),
      actualizadoEn: ahora,
    })
    .where(eq(publicacion.id, e.publicacionId));
  return v.resumen;
}
