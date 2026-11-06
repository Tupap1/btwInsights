// Normaliza las respuestas de Meta (reels de Facebook, media de Instagram y cuentas) a los tipos del dominio.
// Funciones puras. Meta da el dato "de ahora": datoActualizadoEn = leidoEn. MetricasMeta ya llega armado.
//
// Cada lectura es solo de Meta: aquí nunca entra una cifra de Zernio. Si MetricasMeta viene vacío no hay
// lectura (lectura = null); si trae métricas, la lectura existe y las que fallaron quedan en null con su error.
import { z } from "zod";
import {
  type Cifras,
  type LecturaVista,
  type MetricasMeta,
  type PostLeido,
  type PublicacionVista,
  cifrasVacias,
} from "../tipos";
import { errorDeForma, fecha, mapaNumerico, msASegundos, numero, numeroTolerante, sumar, texto, textoTolerante } from "./comun";
import type { CuentaLeida } from "./zernio";

/** Valor de una métrica: número si llegó bien y es número; null si falló, no llegó o no es número. */
const num = (m: MetricasMeta, nombre: string): number | null => {
  const x = m[nombre];
  return x && x.ok ? numero(x.valor) : null;
};

/** Valor de una métrica que es un objeto de números ({"COMMENT":1}). Falló, no llegó o no es objeto → null. */
const objeto = (m: MetricasMeta, nombre: string): Record<string, number> | null => {
  const x = m[nombre];
  return x && x.ok ? mapaNumerico(x.valor) : null;
};

/** Mensajes de las métricas que Meta rechazó (sin URL ni token: así llegan en MetricasMeta). */
const erroresDe = (m: MetricasMeta): string[] =>
  Object.entries(m).flatMap(([nombre, x]) => (x.ok ? [] : [`${nombre}: ${x.error}`]));

const reelFbEsquema = z.object({
  id: z.string().min(1),
  description: textoTolerante,
  created_time: textoTolerante,
  permalink_url: textoTolerante,
  length: numeroTolerante,
});

/** Enlace de Facebook: la ruta relativa (/reel/123/) se completa con el dominio; una URL completa se respeta. */
const enlaceFacebook = (ruta: string | null): string | null => {
  if (ruta === null) return null;
  return /^https?:\/\//i.test(ruta) ? ruta : `https://www.facebook.com${ruta.startsWith("/") ? "" : "/"}${ruta}`;
};

export function metaReelFacebookAPost(reel: unknown, metricas: MetricasMeta, leidoEn: Date): PostLeido {
  const r = reelFbEsquema.safeParse(reel);
  if (!r.success) throw errorDeForma("reel de Facebook sin id");
  const v = r.data;
  const publicacion: PublicacionVista = {
    red: "facebook",
    origen: "meta",
    cuenta: null,
    postIdPlataforma: v.id,
    zernioPostId: null,
    etiquetas: [],
    enlace: enlaceFacebook(texto(v.permalink_url)),
    texto: texto(v.description),
    duracionS: numero(v.length),
    programadoPara: null,
    publicadoEn: fecha(v.created_time),
    estado: "publicado",
  };
  if (Object.keys(metricas).length === 0) return { publicacion, lectura: null };

  // Meta omite las claves en cero: si la métrica llegó bien, la que no está vale 0.
  const acciones = objeto(metricas, "post_video_social_actions");
  const reacciones = objeto(metricas, "post_video_likes_by_reaction_type");

  const cifras: Cifras = {
    ...cifrasVacias(),
    vistas: num(metricas, "blue_reels_play_count"),
    reproduccionesConRepeticion: num(metricas, "fb_reels_total_plays"),
    completos: num(metricas, "total_video_complete_views"),
    tiempoPromedioS: msASegundos(num(metricas, "post_video_avg_time_watched")),
    tiempoTotalS: msASegundos(num(metricas, "post_video_view_time")),
    comentarios: acciones ? (acciones["COMMENT"] ?? 0) : null,
    compartidos: acciones ? (acciones["SHARE"] ?? 0) : null,
    interacciones: acciones ? sumar(acciones) : null,
    meGusta: reacciones ? sumar(reacciones) : null,
  };
  const lectura: LecturaVista = {
    fuente: "meta",
    via: "api",
    datoActualizadoEn: leidoEn,
    cifras,
    reacciones,
    paisPrincipal: null,
    curva: null,
    errores: erroresDe(metricas),
  };
  return { publicacion, lectura };
}

const mediaIgEsquema = z.object({
  id: z.string().min(1),
  caption: textoTolerante,
  media_product_type: textoTolerante,
  permalink: textoTolerante,
  timestamp: textoTolerante,
});

/** Media de Instagram → post. Solo los REELS; cualquier otro tipo (feed, historia) devuelve null. */
export function metaMediaInstagramAPost(media: unknown, metricas: MetricasMeta, leidoEn: Date): PostLeido | null {
  const r = mediaIgEsquema.safeParse(media);
  if (!r.success) throw errorDeForma("media de Instagram sin id");
  const m = r.data;
  if (m.media_product_type !== "REELS") return null;
  const publicacion: PublicacionVista = {
    red: "instagram",
    origen: "meta",
    cuenta: null,
    postIdPlataforma: m.id,
    zernioPostId: null,
    etiquetas: [],
    enlace: texto(m.permalink),
    texto: texto(m.caption),
    duracionS: null,
    programadoPara: null,
    publicadoEn: fecha(m.timestamp),
    estado: "publicado",
  };
  if (Object.keys(metricas).length === 0) return { publicacion, lectura: null };

  const cifras: Cifras = {
    ...cifrasVacias(),
    vistas: num(metricas, "views"),
    alcance: num(metricas, "reach"),
    meGusta: num(metricas, "likes"),
    comentarios: num(metricas, "comments"),
    compartidos: num(metricas, "shares"),
    guardados: num(metricas, "saved"),
    interacciones: num(metricas, "total_interactions"),
    tiempoPromedioS: msASegundos(num(metricas, "ig_reels_avg_watch_time")),
    tiempoTotalS: msASegundos(num(metricas, "ig_reels_video_view_total_time")),
  };
  const lectura: LecturaVista = {
    fuente: "meta",
    via: "api",
    datoActualizadoEn: leidoEn,
    cifras,
    reacciones: null,
    paisPrincipal: null,
    curva: null,
    errores: erroresDe(metricas),
  };
  return { publicacion, lectura };
}

const cuentaFbEsquema = z.object({ id: textoTolerante, followers_count: numeroTolerante, fan_count: numeroTolerante });
const cuentaIgEsquema = z.object({ id: textoTolerante, followers_count: numeroTolerante, media_count: numeroTolerante });

/** Página de Facebook: seguidores = followers_count (si falta, fan_count). Meta no da el número de publicaciones. */
export function metaCuentaFacebook(resp: unknown, leidoEn: Date): CuentaLeida {
  const r = cuentaFbEsquema.safeParse(resp);
  if (!r.success) throw errorDeForma("cuenta de Facebook");
  return {
    red: "facebook",
    cuenta: texto(r.data.id),
    fuente: "meta",
    leidoEn,
    seguidores: numero(r.data.followers_count) ?? numero(r.data.fan_count),
    publicaciones: null,
  };
}

export function metaCuentaInstagram(resp: unknown, leidoEn: Date): CuentaLeida {
  const r = cuentaIgEsquema.safeParse(resp);
  if (!r.success) throw errorDeForma("cuenta de Instagram");
  return {
    red: "instagram",
    cuenta: texto(r.data.id),
    fuente: "meta",
    leidoEn,
    seguidores: numero(r.data.followers_count),
    publicaciones: numero(r.data.media_count),
  };
}
