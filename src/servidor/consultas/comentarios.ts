// Consultas de los comentarios del inbox de Zernio: /comentarios, la sección del detalle de un reel y la tarjeta
// de /hoy. De quien comenta solo existe el @: la base no guarda nada más.
import "server-only";
import { and, eq, isNull, max, type SQL } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { comentario, hiloComentarios, publicacion } from "../db/esquema";
import type { Red } from "../tipos";

export type VerComentarios = "sin_responder" | "todos";

export interface TarjetaComentario {
  id: number;
  red: Red;
  /** El @ de quien comenta. null si no vino. */
  autorUsuario: string | null;
  texto: string;
  creadoEn: Date | null;
  /** true / false, o null si no se sabe (faltan respuestas por conocer). */
  respondido: boolean | null;
  /** El del comentario; si no hay, el de la publicación. */
  enlace: string | null;
  reelId: string | null;
  publicacionId: number;
}

export interface VistaComentarios {
  ver: VerComentarios;
  comentarios: TarjetaComentario[];
  /** Los de otras personas que no desaparecieron y están sin responder (`respondido === false`). */
  sinResponder: number;
  /** Los de otras personas que no desaparecieron. */
  total: number;
  /** El `leido_en` más reciente de hilo_comentarios. null = nunca se leyó un hilo. */
  ultimaLectura: Date | null;
}

/** `?ver=todos` → todos; cualquier otra cosa → "Sin responder". */
export function leerVer(v: string | string[] | undefined): VerComentarios {
  return v === "todos" ? "todos" : "sin_responder";
}

/**
 * Si un comentario de primer nivel de otra persona ya se respondió.
 *  - true: alguna respuesta guardada es de la cuenta;
 *  - false: ninguna lo es y la plataforma no cuenta más respuestas de las guardadas (se conocen todas);
 *  - null: en otro caso. No se adivina.
 */
export function calcularRespondido(c: {
  respuestas: number | null;
  guardadas: readonly { esPropio: boolean }[];
}): boolean | null {
  if (c.guardadas.some((r) => r.esPropio)) return true;
  if (c.respuestas !== null && c.respuestas <= c.guardadas.length) return false;
  return null;
}

async function cargarTarjetas(db: BaseDeDatos, filtro?: SQL): Promise<TarjetaComentario[]> {
  const filas = await db
    .select({
      id: comentario.id,
      red: comentario.red,
      idPlataforma: comentario.idPlataforma,
      padre: comentario.padreIdPlataforma,
      texto: comentario.texto,
      autorUsuario: comentario.autorUsuario,
      esPropio: comentario.esPropio,
      creadoEn: comentario.creadoEn,
      respuestas: comentario.respuestas,
      enlace: comentario.enlace,
      publicacionId: comentario.publicacionId,
      enlacePublicacion: publicacion.enlace,
      reelId: publicacion.reelId,
    })
    .from(comentario)
    .innerJoin(publicacion, eq(comentario.publicacionId, publicacion.id))
    .where(and(isNull(comentario.desaparecioEn), filtro));

  const respuestasDe = new Map<string, { esPropio: boolean }[]>();
  for (const f of filas) {
    if (f.padre === null) continue;
    const k = `${f.red}:${f.padre}`;
    respuestasDe.set(k, [...(respuestasDe.get(k) ?? []), { esPropio: f.esPropio }]);
  }

  const tarjetas = filas
    .filter((f) => f.padre === null && !f.esPropio)
    .map<TarjetaComentario>((f) => ({
      id: f.id,
      red: f.red,
      autorUsuario: f.autorUsuario,
      texto: f.texto,
      creadoEn: f.creadoEn,
      respondido: calcularRespondido({ respuestas: f.respuestas, guardadas: respuestasDe.get(`${f.red}:${f.idPlataforma}`) ?? [] }),
      enlace: f.enlace ?? f.enlacePublicacion,
      reelId: f.reelId,
      publicacionId: f.publicacionId,
    }));
  // Del más nuevo al más viejo; los que no traen fecha, al final.
  return tarjetas.sort((a, b) => (b.creadoEn?.getTime() ?? -Infinity) - (a.creadoEn?.getTime() ?? -Infinity) || b.id - a.id);
}

export async function ultimaLecturaComentarios(db: BaseDeDatos): Promise<Date | null> {
  const [f] = await db.select({ ultima: max(hiloComentarios.leidoEn) }).from(hiloComentarios);
  return f?.ultima ? new Date(f.ultima) : null;
}

/** Pantalla /comentarios. */
export async function consultarComentarios(db: BaseDeDatos, ver: VerComentarios): Promise<VistaComentarios> {
  const [todas, ultimaLectura] = await Promise.all([cargarTarjetas(db), ultimaLecturaComentarios(db)]);
  const sinResponder = todas.filter((t) => t.respondido === false);
  return {
    ver,
    comentarios: ver === "todos" ? todas : sinResponder,
    sinResponder: sinResponder.length,
    total: todas.length,
    ultimaLectura,
  };
}

/** Sección "Comentarios" del detalle de un reel: los de todas sus publicaciones. */
export function comentariosDeReel(db: BaseDeDatos, reelId: string): Promise<TarjetaComentario[]> {
  return cargarTarjetas(db, eq(publicacion.reelId, reelId));
}

/** Tarjeta de /hoy. null = nunca se leyó un hilo (no se sabe, no es 0). */
export async function contarSinResponder(db: BaseDeDatos): Promise<number | null> {
  if ((await ultimaLecturaComentarios(db)) === null) return null;
  const todas = await cargarTarjetas(db);
  return todas.filter((t) => t.respondido === false).length;
}

