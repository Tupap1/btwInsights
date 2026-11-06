// Normaliza el inbox de comentarios de Zernio (lista de posts e hilos) a los tipos del dominio.
// Funciones puras: no hacen red ni tocan la base de datos.
//
// Privacidad (decisión de Andrés, 6-nov): de quien comenta solo se conserva `from.username` (el @). El nombre,
// el id de la persona y la foto se descartan aquí: el tipo de salida no tiene campos para ellos, y la salida se
// arma campo por campo (nunca se copia el objeto crudo).
//
// Fechas: Instagram manda `2026-11-05T18:41:29+0000` (sin dos puntos) y TikTok `…000Z`; `fecha` acepta las dos.
import { z } from "zod";
import type { Red } from "../tipos";
import { aRed, fecha, numero, texto } from "./comun";

/** Un post de la lista de /inbox/comments, con lo que hace falta para pedir su hilo. */
export interface FilaListaComentarios {
  /** Id del post en la plataforma (se une con `publicacion.post_id_plataforma`). */
  postId: string;
  red: Red;
  cuentaId: string;
  /** `commentCount` de la lista. null = la fuente no lo dio. */
  conteo: number | null;
  /** Cuándo se publicó el post, según la lista. */
  creadoEn: Date | null;
}

/** Un comentario o respuesta, sin ningún dato personal salvo el @. */
export interface ComentarioVisto {
  idPlataforma: string;
  /** Id del comentario al que responde; null en los de primer nivel. */
  padreIdPlataforma: string | null;
  /** Vacío si el comentario es solo imagen. */
  texto: string;
  /** El @ (`from.username`). null si no vino. */
  autorUsuario: string | null;
  /** El comentario es de la propia cuenta (`from.isOwner`). */
  esPropio: boolean;
  creadoEn: Date | null;
  meGusta: number | null;
  /** `replyCount` de la plataforma. */
  respuestas: number | null;
  oculto: boolean;
  enlace: string | null;
}

const idTexto = z.union([z.string().min(1), z.number()]).transform(String);

const esquemaFila = z.object({
  id: idTexto,
  accountId: idTexto,
  platform: z.string(),
  commentCount: z.unknown().optional(),
  createdTime: z.unknown().optional(),
  isAd: z.unknown().optional(),
});

/**
 * Filas de la lista. Las de pauta (`isAd: true`) se ignoran sin contarlas; las que no se entienden (sin id, sin
 * cuenta o de una red desconocida) se cuentan en `descartadas`.
 */
export function filasDeLista(crudas: readonly unknown[]): { filas: FilaListaComentarios[]; descartadas: number } {
  const filas: FilaListaComentarios[] = [];
  let descartadas = 0;
  for (const c of crudas) {
    const p = esquemaFila.safeParse(c);
    const red = p.success ? aRed(p.data.platform) : null;
    if (!p.success || red === null) {
      descartadas += 1;
      continue;
    }
    if (p.data.isAd === true) continue;
    filas.push({
      postId: p.data.id,
      red,
      cuentaId: p.data.accountId,
      conteo: numero(p.data.commentCount),
      creadoEn: fecha(p.data.createdTime),
    });
  }
  return { filas, descartadas };
}

const esquemaComentario = z.object({
  id: idTexto,
  message: z.unknown().optional(),
  createdTime: z.unknown().optional(),
  from: z.unknown().optional(),
  likeCount: z.unknown().optional(),
  replyCount: z.unknown().optional(),
  isHidden: z.unknown().optional(),
  url: z.unknown().optional(),
  replies: z.unknown().optional(),
});

const esquemaAutor = z.object({ username: z.unknown().optional(), isOwner: z.unknown().optional() });

/**
 * Aplana un hilo: cada comentario y cada respuesta (a cualquier profundidad) quedan en la lista con el id de su
 * padre. Un comentario que viene dos veces se guarda una sola vez, con el padre si alguna de las dos lo trae.
 * `descartados` cuenta los que no se pudieron entender; si es mayor que 0 el hilo no debe darse por completo.
 */
export function normalizarHilo(crudos: readonly unknown[]): { comentarios: ComentarioVisto[]; descartados: number } {
  const porId = new Map<string, ComentarioVisto>();
  let descartados = 0;

  const visitar = (lista: readonly unknown[], padre: string | null): void => {
    for (const c of lista) {
      const p = esquemaComentario.safeParse(c);
      if (!p.success) {
        descartados += 1;
        continue;
      }
      const d = p.data;
      const autor = esquemaAutor.safeParse(d.from);
      const visto: ComentarioVisto = {
        idPlataforma: d.id,
        padreIdPlataforma: padre,
        texto: typeof d.message === "string" ? d.message : "",
        autorUsuario: autor.success ? texto(autor.data.username) : null,
        esPropio: autor.success && autor.data.isOwner === true,
        creadoEn: fecha(d.createdTime),
        meGusta: numero(d.likeCount),
        respuestas: numero(d.replyCount),
        oculto: d.isHidden === true,
        enlace: texto(d.url),
      };
      const previo = porId.get(visto.idPlataforma);
      if (previo === undefined) porId.set(visto.idPlataforma, visto);
      else if (previo.padreIdPlataforma === null && padre !== null) porId.set(visto.idPlataforma, visto);
      if (Array.isArray(d.replies)) visitar(d.replies as unknown[], d.id);
    }
  };

  visitar(crudos, null);
  return { comentarios: [...porId.values()], descartados };
}
