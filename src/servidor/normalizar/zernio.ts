// Normaliza las respuestas de Zernio (analytics, cola de posts y seguidores) a los tipos del dominio.
// Funciones puras: no hacen red ni tocan la base de datos.
//
// zernioPostId: en /v1/analytics cada post trae `_id` (id interno de analytics) y `latePostId`. Los fixtures
// muestran que `_id` NO es el `_id` de /v1/posts (ninguno coincide con los 18 borradores) y que `latePostId` es
// null en los 17 posts, todos `isExternal: true` (publicados fuera de Zernio, sin post en la cola). Por eso
// zernioPostId = `latePostId` (el enlace al post de /v1/posts, para los que Zernio sí publicó) o null; jamás `_id`.
//
// reelsSkipRate: solo lo da Instagram (en TikTok llega 0 porque no existe). En el fixture va de 40 a 72.7
// (p. ej. 47.4), así que YA viene en porcentaje 0-100 y se copia tal cual; no se multiplica.
//
// completionRate: en Instagram llega siempre 0 (la API de IG no lo da), así que solo se usa en TikTok.
import { z } from "zod";
import {
  type Cifras,
  type EstadoPublicacion,
  type LecturaVista,
  type PostLeido,
  type PublicacionVista,
  type Red,
  cifrasVacias,
} from "../tipos";
import {
  aRed,
  errorDeForma,
  fecha,
  fraccionAPct,
  limpiar,
  mapaFraccionAPct,
  mapaNumerico,
  msASegundos,
  numero,
  numeroTolerante,
  objetoTolerante,
  paisPrincipal,
  texto,
  textoTolerante,
} from "./comun";

export interface CuentaLeida {
  red: Red;
  cuenta: string | null;
  fuente: "zernio" | "meta";
  leidoEn: Date;
  seguidores: number | null;
  publicaciones: number | null;
}

const analiticaEsquema = z.object({
  views: numeroTolerante,
  reach: numeroTolerante,
  likes: numeroTolerante,
  comments: numeroTolerante,
  shares: numeroTolerante,
  saves: numeroTolerante,
  follows: numeroTolerante,
  profileViews: numeroTolerante,
  igReelsAvgWatchTime: numeroTolerante,
  igReelsVideoViewTotalTime: numeroTolerante,
  reelsSkipRate: numeroTolerante,
  completionRate: numeroTolerante,
  videoDurationSeconds: numeroTolerante,
  impressionSources: objetoTolerante,
  audienceTypes: objetoTolerante,
  audienceCountries: objetoTolerante,
  retentionCurve: objetoTolerante,
  lastUpdated: textoTolerante,
});

const plataformaEsquema = z.object({
  platform: textoTolerante,
  platformPostId: textoTolerante,
  platformPostUrl: textoTolerante,
  accountUsername: textoTolerante,
  accountId: z
    .union([z.string(), z.object({ username: textoTolerante })])
    .nullish()
    .catch(undefined),
});

const postAnaliticaEsquema = z.object({
  _id: z.string().min(1),
  latePostId: textoTolerante,
  content: textoTolerante,
  publishedAt: textoTolerante,
  scheduledFor: textoTolerante,
  status: textoTolerante,
  platform: textoTolerante,
  platformPostUrl: textoTolerante,
  analytics: analiticaEsquema.nullish().catch(undefined),
  platforms: z.array(plataformaEsquema).nullish().catch(undefined),
});

const ESTADOS: Record<string, EstadoPublicacion> = {
  draft: "borrador",
  pending_approval: "pendiente_aprobacion",
  scheduled: "programado",
  publishing: "publicando",
  published: "publicado",
  partial: "parcial",
  failed: "fallido",
  cancelled: "cancelado",
};

const estadoDe = (v: string | null | undefined): EstadoPublicacion => {
  const e = v ? ESTADOS[v] : undefined;
  if (!e) throw errorDeForma("estado de publicación desconocido");
  return e;
};

/** Un elemento de `posts[]` de /v1/analytics → la publicación y su lectura de Zernio. */
export function zernioAnaliticaAPost(post: unknown, leidoEn: Date): PostLeido {
  const r = postAnaliticaEsquema.safeParse(post);
  if (!r.success) throw errorDeForma("post de analytics sin _id");
  const p = r.data;
  const plat = p.platforms?.[0];
  const red = aRed(p.platform ?? plat?.platform);
  if (!red) throw errorDeForma("post de analytics de una red no soportada");
  const a = p.analytics ?? null;

  const publicacion: PublicacionVista = {
    red,
    origen: "zernio",
    cuenta: texto(plat?.accountUsername),
    postIdPlataforma: texto(plat?.platformPostId),
    zernioPostId: texto(p.latePostId),
    etiquetas: [],
    enlace: texto(p.platformPostUrl) ?? texto(plat?.platformPostUrl),
    texto: texto(p.content),
    duracionS: limpiar(a?.videoDurationSeconds),
    programadoPara: fecha(p.scheduledFor),
    publicadoEn: fecha(p.publishedAt),
    estado: estadoDe(p.status),
  };
  if (!a) return { publicacion, lectura: null };

  const vistas = numero(a.views);
  // TikTok devuelve reach 0 cuando el dato no llegó; con vistas > 0 es imposible, así que va null.
  const alcanceCrudo = numero(a.reach);
  const alcance = red === "tiktok" && alcanceCrudo === 0 && vistas !== null && vistas > 0 ? null : alcanceCrudo;

  const curvaCruda = mapaNumerico(a.retentionCurve);
  const curva = curvaCruda && Object.keys(curvaCruda).length > 0 ? mapaFraccionAPct(curvaCruda) : null;
  // Clave exacta de la curva; si falta, null (hay curvas que solo traen segundos pares). Nada de interpolar.
  const ret = (s: number): number | null => (curva ? (curva[String(s)] ?? null) : null);

  const fuentes = mapaNumerico(a.impressionSources);
  const tipos = mapaNumerico(a.audienceTypes);

  const cifras: Cifras = {
    ...cifrasVacias(),
    vistas,
    alcance,
    meGusta: numero(a.likes),
    comentarios: numero(a.comments),
    compartidos: numero(a.shares),
    guardados: numero(a.saves),
    seguidoresGanados: numero(a.follows),
    visitasPerfil: numero(a.profileViews),
    tiempoPromedioS: msASegundos(a.igReelsAvgWatchTime),
    tiempoTotalS: msASegundos(a.igReelsVideoViewTotalTime),
    pctCompleto: red === "tiktok" ? fraccionAPct(a.completionRate) : null,
    pctSalta3s: red === "instagram" ? numero(a.reelsSkipRate) : null,
    ret1s: ret(1),
    ret3s: ret(3),
    ret5s: ret(5),
    ret10s: ret(10),
    pctParaTi: fuentes && "forYou" in fuentes ? fraccionAPct(fuentes["forYou"]) : null,
    pctBusqueda: fuentes && "search" in fuentes ? fraccionAPct(fuentes["search"]) : null,
    pctNoSeguidores: tipos && "nonFollower" in tipos ? fraccionAPct(tipos["nonFollower"]) : null,
  };

  const lectura: LecturaVista = {
    fuente: "zernio",
    via: "api",
    datoActualizadoEn: fecha(a.lastUpdated) ?? leidoEn,
    cifras,
    reacciones: null,
    paisPrincipal: paisPrincipal(a.audienceCountries),
    curva,
    errores: [],
  };
  return { publicacion, lectura };
}

const colaEsquema = z.object({
  _id: z.string().min(1),
  content: textoTolerante,
  scheduledFor: textoTolerante,
  publishedAt: textoTolerante,
  status: textoTolerante,
  tags: z.array(z.unknown()).nullish().catch(undefined),
  platforms: z.array(plataformaEsquema).nullish().catch(undefined),
});

/** Un post de /v1/posts → una publicación por cada elemento de `platforms[]` (solo las redes que seguimos). */
export function zernioColaAPublicaciones(post: unknown): PublicacionVista[] {
  const r = colaEsquema.safeParse(post);
  if (!r.success) throw errorDeForma("post de la cola sin _id");
  const p = r.data;
  const estado = estadoDe(p.status);
  const etiquetas = (p.tags ?? []).filter((t): t is string => typeof t === "string" && t !== "");
  const salida: PublicacionVista[] = [];
  for (const plat of p.platforms ?? []) {
    const red = aRed(plat.platform);
    if (!red) continue;
    const cuenta =
      typeof plat.accountId === "object" && plat.accountId !== null ? texto(plat.accountId.username) : null;
    salida.push({
      red,
      origen: "zernio",
      cuenta: cuenta ?? texto(plat.accountUsername),
      postIdPlataforma: texto(plat.platformPostId),
      zernioPostId: p._id,
      etiquetas,
      enlace: texto(plat.platformPostUrl),
      texto: texto(p.content),
      duracionS: null,
      programadoPara: fecha(p.scheduledFor),
      publicadoEn: fecha(p.publishedAt),
      estado,
    });
  }
  return salida;
}

const seguidoresEsquema = z.object({
  accounts: z
    .array(
      z.object({
        platform: textoTolerante,
        username: textoTolerante,
        currentFollowers: numeroTolerante,
      }),
    )
    .nullish()
    .catch(undefined),
});

/** /v1/accounts/follower-stats → seguidores por cuenta. Zernio no da el número de publicaciones. */
export function zernioSeguidores(resp: unknown, leidoEn: Date): CuentaLeida[] {
  const r = seguidoresEsquema.safeParse(resp);
  if (!r.success) throw errorDeForma("estadísticas de seguidores");
  const salida: CuentaLeida[] = [];
  for (const c of r.data.accounts ?? []) {
    const red = aRed(c.platform);
    if (!red) continue;
    salida.push({
      red,
      cuenta: texto(c.username),
      fuente: "zernio",
      leidoEn,
      seguidores: numero(c.currentFollowers),
      publicaciones: null,
    });
  }
  return salida;
}
