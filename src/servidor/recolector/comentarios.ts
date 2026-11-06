// Bloque "comentarios" del recolector: lee el inbox de Zernio (solo GET) y guarda los comentarios.
// Reglas: un hilo que falla no corta a los demás; solo una lectura completa marca comentarios como desaparecidos;
// nada se borra; de quien comenta solo se guarda el @ (ver normalizar/comentarios.ts).
import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { comentario, hiloComentarios, publicacion } from "../db/esquema";
import type { ClienteZernio } from "../fuentes/zernio";
import {
  filasDeLista,
  normalizarHilo,
  type ComentarioVisto,
  type FilaListaComentarios,
} from "../normalizar/comentarios";

export const MAX_HILOS_POR_CORRIDA = 30;
const HORA = 3_600_000;
const RELEER_TRAS_MS = 24 * HORA;
const LOTE = 300;

export interface HiloConocido {
  conteoFuente: number | null;
  completo: boolean;
  leidoEn: Date | null;
}

export interface CandidatoHilo {
  publicacionId: number;
  fila: FilaListaComentarios;
}

/**
 * Qué hilos leer en esta corrida: los que no tienen fila en hilo_comentarios, cambiaron de conteo, quedaron
 * incompletos o se leyeron hace más de 24 h. Un hilo de conteo 0 que nunca tuvo comentarios no se lee. Como mucho
 * `max`, primero los posts más recientes (los sin fecha, al final).
 */
export function elegirHilos(
  candidatos: readonly CandidatoHilo[],
  conocidos: ReadonlyMap<number, HiloConocido>,
  ahora: Date,
  max = MAX_HILOS_POR_CORRIDA,
): CandidatoHilo[] {
  const elegidos = candidatos.filter(({ publicacionId, fila }) => {
    const k = conocidos.get(publicacionId);
    if (fila.conteo === 0 && (k === undefined || k.conteoFuente === 0)) return false;
    if (k === undefined) return true;
    if (!k.completo) return true;
    if (fila.conteo !== null && fila.conteo !== k.conteoFuente) return true;
    return k.leidoEn === null || ahora.getTime() - k.leidoEn.getTime() > RELEER_TRAS_MS;
  });
  const t = (c: CandidatoHilo): number => c.fila.creadoEn?.getTime() ?? Number.NEGATIVE_INFINITY;
  return elegidos.sort((a, b) => t(b) - t(a)).slice(0, max);
}

export interface ResultadoComentarios {
  comentariosNuevos: number;
  hilosLeidos: number;
  /** Un mensaje por cada problema (lista, hilo o comentario que no se entendió). Sin llaves: vienen de la red/zod. */
  errores: string[];
}

/** Guarda los comentarios de un hilo con upsert por (red, id_plataforma). Devuelve cuántos son nuevos. */
async function guardarComentarios(
  db: BaseDeDatos,
  publicacionId: number,
  red: FilaListaComentarios["red"],
  vistos: readonly ComentarioVisto[],
  ahora: Date,
): Promise<number> {
  let nuevos = 0;
  for (let i = 0; i < vistos.length; i += LOTE) {
    const filas = vistos.slice(i, i + LOTE).map((v) => ({
      publicacionId,
      red,
      idPlataforma: v.idPlataforma,
      padreIdPlataforma: v.padreIdPlataforma,
      texto: v.texto,
      autorUsuario: v.autorUsuario,
      esPropio: v.esPropio,
      creadoEn: v.creadoEn,
      meGusta: v.meGusta,
      respuestas: v.respuestas,
      oculto: v.oculto,
      enlace: v.enlace,
      leidoEn: ahora,
      actualizadoEn: ahora,
    }));
    const r = await db
      .insert(comentario)
      .values(filas)
      .onConflictDoUpdate({
        target: [comentario.red, comentario.idPlataforma],
        set: {
          texto: sql`excluded.texto`,
          // Un dato conocido no se pisa con null.
          meGusta: sql`coalesce(excluded.me_gusta, ${comentario.meGusta})`,
          respuestas: sql`coalesce(excluded.respuestas, ${comentario.respuestas})`,
          oculto: sql`excluded.oculto`,
          enlace: sql`coalesce(excluded.enlace, ${comentario.enlace})`,
          actualizadoEn: ahora,
          desaparecioEn: null,
        },
      })
      .returning({ nuevo: sql<boolean>`(xmax = 0)` });
    nuevos += r.filter((x) => x.nuevo).length;
  }
  return nuevos;
}

/** Marca como desaparecidos los de primer nivel que ya no vinieron y sus respuestas. Nada se borra. */
async function marcarDesaparecidos(
  db: BaseDeDatos,
  publicacionId: number,
  vistos: ReadonlySet<string>,
  ahora: Date,
): Promise<void> {
  const condiciones = [
    eq(comentario.publicacionId, publicacionId),
    isNull(comentario.padreIdPlataforma),
    isNull(comentario.desaparecioEn),
  ];
  if (vistos.size > 0) condiciones.push(notInArray(comentario.idPlataforma, [...vistos]));
  const padres = await db
    .update(comentario)
    .set({ desaparecioEn: ahora })
    .where(and(...condiciones))
    .returning({ id: comentario.idPlataforma });
  if (padres.length === 0) return;
  await db
    .update(comentario)
    .set({ desaparecioEn: ahora })
    .where(
      and(
        eq(comentario.publicacionId, publicacionId),
        isNull(comentario.desaparecioEn),
        isNotNull(comentario.padreIdPlataforma),
        inArray(comentario.padreIdPlataforma, padres.map((p) => p.id)),
      ),
    );
}

/**
 * Lee la lista del inbox, elige los hilos que tocan, los lee y los guarda. No lanza por un hilo que falla: lo
 * anota en `errores` y sigue. Lanza solo si la lista no se pudo leer.
 */
export async function leerComentarios(
  db: BaseDeDatos,
  zernio: ClienteZernio,
  ahora: Date,
  limpiar: (e: unknown) => string = (e) => (e instanceof Error ? e.message : String(e)),
): Promise<ResultadoComentarios> {
  const resultado: ResultadoComentarios = { comentariosNuevos: 0, hilosLeidos: 0, errores: [] };

  const { filas, descartadas } = filasDeLista(await zernio.postsConComentarios());
  if (descartadas > 0) resultado.errores.push(`${descartadas} filas de la lista de comentarios no se entendieron`);

  // 1. Unir cada fila con su publicación. Sin publicación: se ignora.
  const pubs = await db
    .select({ id: publicacion.id, red: publicacion.red, postId: publicacion.postIdPlataforma })
    .from(publicacion)
    .where(isNotNull(publicacion.postIdPlataforma));
  const idDe = new Map(pubs.map((p) => [`${p.red}:${p.postId ?? ""}`, p.id]));
  const candidatos: CandidatoHilo[] = [];
  for (const fila of filas) {
    const publicacionId = idDe.get(`${fila.red}:${fila.postId}`);
    if (publicacionId !== undefined) candidatos.push({ publicacionId, fila });
  }

  // 2. Elegir qué hilos leer.
  const conocidasFilas = await db.select().from(hiloComentarios);
  const conocidos = new Map<number, HiloConocido>(
    conocidasFilas.map((h) => [
      h.publicacionId,
      { conteoFuente: h.conteoFuente, completo: h.completo, leidoEn: h.leidoEn },
    ]),
  );

  for (const { publicacionId, fila } of elegirHilos(candidatos, conocidos, ahora)) {
    try {
      const hilo = await zernio.comentariosDePost(fila.postId, fila.cuentaId);
      const { comentarios, descartados } = normalizarHilo(hilo.comentarios);
      const completo = hilo.completo && descartados === 0;
      resultado.comentariosNuevos += await guardarComentarios(db, publicacionId, fila.red, comentarios, ahora);
      if (completo) {
        await marcarDesaparecidos(db, publicacionId, new Set(comentarios.map((c) => c.idPlataforma)), ahora);
      }
      await db
        .insert(hiloComentarios)
        .values({ publicacionId, conteoFuente: fila.conteo, completo, leidoEn: ahora })
        .onConflictDoUpdate({
          target: hiloComentarios.publicacionId,
          set: { conteoFuente: fila.conteo, completo, leidoEn: ahora },
        });
      resultado.hilosLeidos += 1;
      if (descartados > 0) resultado.errores.push(`${fila.red} ${fila.postId}: ${descartados} comentarios no se entendieron`);
    } catch (e) {
      resultado.errores.push(`${fila.red} ${fila.postId}: ${limpiar(e)}`);
    }
  }
  return resultado;
}
