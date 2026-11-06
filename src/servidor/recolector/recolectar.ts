// El recolector: lee Zernio y Meta, guarda lo que llega (con guardar.ts) y abre o cierra alertas.
// Reglas: una sola corrida a la vez (tabla corrida), un bloque que falla no corta a los demás,
// nada se borra y ningún mensaje lleva una llave.
import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, like, max, sql } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { alerta, corrida, lectura, publicacion, reel } from "../db/esquema";
import type { ClienteMeta } from "../fuentes/meta";
import { ErrorFuente, redactar } from "../fuentes/http";
import type { ClienteZernio, EstadoZernio } from "../fuentes/zernio";
import { emparejarLote, type ContextoEmparejar } from "../emparejar";
import {
  abrirAlerta,
  guardarCuenta,
  guardarLectura,
  guardarPublicacion,
  resolverAlertas,
  type AlertaNueva,
  type Emparejamiento,
} from "../guardar";
import {
  metaCuentaFacebook,
  metaCuentaInstagram,
  metaMediaInstagramAPost,
  metaReelFacebookAPost,
} from "../normalizar/meta";
import { zernioAnaliticaAPost, zernioColaAPublicaciones, zernioSeguidores } from "../normalizar/zernio";
import type { MetricasMeta, PostLeido, PublicacionVista, Red, ReelCandidato } from "../tipos";
import {
  alertaDeCodigoMeta,
  alertaLecturaAtrasada,
  alertasNuevasDeCola,
  CLAVE_LECTURA_ATRASADA,
  CLAVE_META_PERMISOS,
  CLAVE_META_TOKEN,
  type PublicacionParaAlertas,
} from "./alertas";
import { porLeer } from "./plan";

export interface DepsRecolector {
  zernio?: ClienteZernio;
  meta?: ClienteMeta;
  ahora?: () => Date;
  /** Tiempo máximo para pedir métricas a Meta. Lo que no alcance queda para la siguiente corrida. */
  presupuestoMs?: number;
  origen: "cli" | "http" | "boton";
  /** Valores que no pueden salir en ningún mensaje. */
  secretos: string[];
}

export interface ResumenCorrida {
  estado: "ok" | "parcial" | "error";
  corridaId: number;
  publicacionesNuevas: number;
  lecturasNuevas: number;
  lecturasRepetidas: number;
  pendientes: number;
  alertasAbiertas: number;
  errores: string[];
}

export type Resumen = { estado: "ocupado" } | ResumenCorrida;

const MIN = 60_000;
const HORA = 3_600_000;
const CORRIDA_ABANDONADA_MS = 10 * MIN;
const FALLOS_SEGUIDOS_MAX = 3;
const DESFASE_BOGOTA_MS = 5 * HORA;

const ESTADOS_COLA: readonly EstadoZernio[] = [
  "draft",
  "pending_approval",
  "scheduled",
  "publishing",
  "published",
  "partial",
  "failed",
  "cancelled",
];

// Sin total_video_complete_views: Meta no la da para Reels (5-nov: vacía en los 11, sola o junto a las demás).
const NOMBRES_FB = [
  "blue_reels_play_count",
  "fb_reels_total_plays",
  "post_video_avg_time_watched",
  "post_video_view_time",
  "post_video_social_actions",
  "post_video_likes_by_reaction_type",
] as const;

const NOMBRES_IG = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
  "total_interactions",
  "ig_reels_avg_watch_time",
  "ig_reels_video_view_total_time",
] as const;

const NOMBRE_RED: Record<Red, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };

// ---------- Utilidades ----------

const diaBogota = (f: Date): string => new Date(f.getTime() - DESFASE_BOGOTA_MS).toISOString().slice(0, 10);

const fmtHora = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Bogota",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "hoy a las 19:30", "mañana a las 19:30" o "el 2026-11-09 a las 19:30" (hora de Bogotá). */
function cuando(f: Date, ahora: Date): string {
  const dia = diaBogota(f);
  const hoy = diaBogota(ahora);
  const diff = Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / (24 * HORA));
  const hora = fmtHora.format(f);
  if (diff === 0) return `hoy a las ${hora}`;
  if (diff === 1) return `mañana a las ${hora}`;
  if (diff === -1) return `ayer a las ${hora}`;
  return `el ${dia} a las ${hora}`;
}

/** Choque con un índice único de Postgres (código 23505), también si Drizzle lo envuelve. */
function esChoqueUnico(e: unknown): boolean {
  let actual: unknown = e;
  for (let i = 0; i < 4 && typeof actual === "object" && actual !== null; i += 1) {
    const o = actual as { code?: unknown; cause?: unknown };
    if (o.code === "23505") return true;
    actual = o.cause;
  }
  return false;
}

// ---------- Contexto para emparejar ----------

async function cargarContexto(db: BaseDeDatos): Promise<ContextoEmparejar> {
  const reels = await db.select().from(reel);
  const pubs = await db.select().from(publicacion).where(isNotNull(publicacion.reelId));
  const porZernioId = new Map<string, string>();
  const porPostId = new Map<string, string>();
  const delReel = new Map<string, typeof pubs>();
  for (const p of pubs) {
    if (p.reelId === null) continue;
    if (p.zernioPostId) porZernioId.set(p.zernioPostId, p.reelId);
    if (p.postIdPlataforma) porPostId.set(`${p.red}:${p.postIdPlataforma}`, p.reelId);
    delReel.set(p.reelId, [...(delReel.get(p.reelId) ?? []), p]);
  }
  const candidatos: ReelCandidato[] = reels.map((r) => {
    const suyas = delReel.get(r.id) ?? [];
    const fechas = new Set<string>();
    if (r.fechaPlan) fechas.add(r.fechaPlan);
    const duraciones: number[] = [];
    if (r.duracionS !== null) duraciones.push(r.duracionS);
    for (const p of suyas) {
      const f = p.publicadoEn ?? p.programadoPara;
      if (f) fechas.add(diaBogota(f));
      if (p.duracionS !== null) duraciones.push(p.duracionS);
    }
    const textos = [r.textoTiktok, r.textoMeta, r.gancho].filter((t): t is string => !!t);
    return { id: r.id, fechas: [...fechas], textos, duracionesS: duraciones };
  });
  return { porZernioId, porPostId, reels: candidatos };
}

// ---------- La corrida ----------

interface ItemMeta {
  publicacionId: number;
  publicadoEn: Date;
  ultimaLectura: Date | null;
  red: "facebook" | "instagram";
  objetoId: string;
  crudo: unknown;
}

export async function recolectar(db: BaseDeDatos, deps: DepsRecolector): Promise<Resumen> {
  const reloj = deps.ahora ?? (() => new Date());
  const inicio = reloj();
  const presupuestoMs = deps.presupuestoMs ?? 50_000;

  // 1. Candado.
  await db
    .update(corrida)
    .set({ estado: "abandonada", terminadaEn: inicio })
    .where(and(eq(corrida.estado, "en_curso"), lt(corrida.iniciadaEn, new Date(inicio.getTime() - CORRIDA_ABANDONADA_MS))));
  let corridaId: number;
  try {
    const [f] = await db
      .insert(corrida)
      .values({ origen: deps.origen, estado: "en_curso", iniciadaEn: inicio })
      .returning({ id: corrida.id });
    if (!f) throw new Error("No se pudo abrir la corrida.");
    corridaId = f.id;
  } catch (e) {
    if (esChoqueUnico(e)) return { estado: "ocupado" };
    throw e;
  }

  const errores: string[] = [];
  let publicacionesNuevas = 0;
  let lecturasNuevas = 0;
  let lecturasRepetidas = 0;
  let pendientes = 0;
  let bloques = 0;
  let bloquesFallidos = 0;
  const fallosNormalizar: Record<"zernio" | "meta", { n: number; primero: string | null }> = {
    zernio: { n: 0, primero: null },
    meta: { n: 0, primero: null },
  };
  let erroresMetricas = 0;
  let intentoMetricas = false;
  let colaOk = true;
  /** Códigos de error que devolvió Meta en esta corrida (190 = token, 10/200 = permisos). */
  const codigosMeta = new Set<number>();
  let metaLeida = false;

  const limpio = (e: unknown): string => {
    const crudo = e instanceof Error ? e.message : String(e);
    return redactar(crudo, deps.secretos).replace(/\s+/g, " ").slice(0, 300);
  };

  const anotarCodigoMeta = (e: unknown): void => {
    if (e instanceof ErrorFuente && e.codigo !== undefined) codigosMeta.add(e.codigo);
  };

  const falloNormalizar = (fuente: "zernio" | "meta", e: unknown): void => {
    const f = fallosNormalizar[fuente];
    f.n += 1;
    f.primero ??= limpio(e);
  };

  /** Corre los pasos de un bloque, cada uno con su try/catch, y abre o cierra la alerta del bloque. */
  async function bloque(fuente: "zernio" | "meta", nombre: string, pasos: Array<() => Promise<void>>): Promise<boolean> {
    bloques += 1;
    const mensajes: string[] = [];
    for (const paso of pasos) {
      try {
        await paso();
      } catch (e) {
        if (fuente === "meta") anotarCodigoMeta(e);
        mensajes.push(limpio(e));
      }
    }
    const clave = `fuente:${fuente}:${nombre}`;
    if (mensajes.length === 0) {
      await resolverAlertas(db, [clave]);
      return true;
    }
    bloquesFallidos += 1;
    const mensaje = `${fuente === "zernio" ? "Zernio" : "Meta"} (${nombre}): ${mensajes.join("; ")}`;
    errores.push(mensaje);
    await abrirAlerta(db, { clave, tipo: "fuente", nivel: "error", mensaje });
    return false;
  }

  let ctx: ContextoEmparejar = { porZernioId: new Map(), porPostId: new Map(), reels: [] };

  /** Empareja en lote y guarda las publicaciones. Devuelve el id guardado de cada una, en el mismo orden. */
  async function guardarPublicaciones(vistas: readonly PublicacionVista[]): Promise<number[]> {
    const resultados = emparejarLote(vistas, ctx);
    const ids: number[] = [];
    for (const [i, v] of vistas.entries()) {
      const r = resultados[i];
      const e: Emparejamiento = r && r.reelId !== null ? { reelId: r.reelId, por: r.por } : { reelId: null, por: null };
      const g = await guardarPublicacion(db, v, e);
      if (g.nueva) publicacionesNuevas += 1;
      ids.push(g.id);
    }
    return ids;
  }

  async function guardarLecturaDe(id: number, publicadoEn: Date | null, p: PostLeido, leidoEn: Date): Promise<void> {
    if (!p.lectura) return;
    const nueva = await guardarLectura(db, id, publicadoEn, p.lectura, leidoEn);
    if (nueva) lecturasNuevas += 1;
    else lecturasRepetidas += 1;
  }

  try {
    ctx = await cargarContexto(db);

    // 3. Zernio.
    const zernio = deps.zernio;
    if (zernio) {
      await bloque("zernio", "seguidores", [
        async () => {
          const t = reloj();
          for (const c of zernioSeguidores(await zernio.seguidores(), t)) await guardarCuenta(db, c);
        },
      ]);

      const cola: PublicacionVista[] = [];
      colaOk = await bloque("zernio", "cola", [
        ...ESTADOS_COLA.map((estado) => async () => {
          for (const post of await zernio.posts(estado)) {
            try {
              cola.push(...zernioColaAPublicaciones(post));
            } catch (e) {
              falloNormalizar("zernio", e);
            }
          }
        }),
        async () => {
          await guardarPublicaciones(cola);
        },
      ]);

      await bloque("zernio", "analytics", [
        async () => {
          const t = reloj();
          const posts: PostLeido[] = [];
          for (const crudo of await zernio.analitica()) {
            try {
              posts.push(zernioAnaliticaAPost(crudo, t));
            } catch (e) {
              falloNormalizar("zernio", e);
            }
          }
          const ids = await guardarPublicaciones(posts.map((p) => p.publicacion));
          for (const [i, p] of posts.entries()) {
            const id = ids[i];
            if (id !== undefined) await guardarLecturaDe(id, p.publicacion.publicadoEn, p, t);
          }
        },
      ]);
    }

    // 4. Meta.
    const meta = deps.meta;
    if (meta) {
      metaLeida = await bloque("meta", "cuentas", [
        async () => {
          await guardarCuenta(db, metaCuentaFacebook(await meta.cuentaFacebook(), reloj()));
        },
        async () => {
          await guardarCuenta(db, metaCuentaInstagram(await meta.cuentaInstagram(), reloj()));
        },
      ]);

      const items: ItemMeta[] = [];

      const guardarListaMeta = async (
        crudos: readonly unknown[],
        normalizar: (crudo: unknown, t: Date) => PostLeido | null,
        red: "facebook" | "instagram",
      ): Promise<void> => {
        const t = reloj();
        const posts: Array<{ crudo: unknown; publicacion: PublicacionVista }> = [];
        for (const crudo of crudos) {
          try {
            const p = normalizar(crudo, t);
            if (p) posts.push({ crudo, publicacion: p.publicacion });
          } catch (e) {
            falloNormalizar("meta", e);
          }
        }
        const ids = await guardarPublicaciones(posts.map((p) => p.publicacion));
        for (const [i, p] of posts.entries()) {
          const id = ids[i];
          const objetoId = p.publicacion.postIdPlataforma;
          if (id === undefined || objetoId === null) continue;
          items.push({
            publicacionId: id,
            publicadoEn: p.publicacion.publicadoEn ?? t,
            ultimaLectura: null,
            red,
            objetoId,
            crudo: p.crudo,
          });
        }
      };

      await bloque("meta", "reels-facebook", [
        async () =>
          guardarListaMeta(await meta.reelsFacebook(), (c, t) => metaReelFacebookAPost(c, {}, t), "facebook"),
      ]);
      await bloque("meta", "media-instagram", [
        async () =>
          guardarListaMeta(await meta.mediaInstagram(), (c, t) => metaMediaInstagramAPost(c, {}, t), "instagram"),
      ]);

      // Las que tocan según el plan, con la última lectura de Meta por la API.
      if (items.length > 0) {
        const ultimas = await db
          .select({ id: lectura.publicacionId, ultima: max(lectura.datoActualizadoEn) })
          .from(lectura)
          .where(
            and(
              inArray(lectura.publicacionId, items.map((i) => i.publicacionId)),
              eq(lectura.fuente, "meta"),
              eq(lectura.via, "api"),
            ),
          )
          .groupBy(lectura.publicacionId);
        const porId = new Map(ultimas.map((u) => [u.id, u.ultima ? new Date(u.ultima) : null]));
        for (const it of items) it.ultimaLectura = porId.get(it.publicacionId) ?? null;
      }
      const toca = porLeer(items, reloj());

      if (toca.length > 0) {
        intentoMetricas = true;
        await bloque("meta", "metricas", [
          async () => {
            let leidas = 0;
            let fallos = 0;
            let seguidos = 0;
            let primero: string | null = null;
            for (const it of toca) {
              if (reloj().getTime() - inicio.getTime() >= presupuestoMs) break;
              if (seguidos >= FALLOS_SEGUIDOS_MAX) break;
              try {
                const nombres = it.red === "facebook" ? NOMBRES_FB : NOMBRES_IG;
                const metricas: MetricasMeta = await meta.metricas(it.objetoId, it.red, nombres);
                const t = reloj();
                const post =
                  it.red === "facebook"
                    ? metaReelFacebookAPost(it.crudo, metricas, t)
                    : metaMediaInstagramAPost(it.crudo, metricas, t);
                if (post?.lectura) {
                  erroresMetricas += post.lectura.errores.length;
                  await guardarLecturaDe(it.publicacionId, it.publicadoEn, post, t);
                }
                leidas += 1;
                seguidos = 0;
              } catch (e) {
                anotarCodigoMeta(e);
                fallos += 1;
                seguidos += 1;
                primero ??= limpio(e);
              }
            }
            pendientes += toca.length - leidas;
            if (fallos > 0) throw new Error(`${fallos} lecturas de métricas fallaron (la primera: ${primero ?? "sin detalle"})`);
          },
        ]);
      }
    }

    // 5. Alertas de normalización y de métricas.
    for (const fuente of ["zernio", "meta"] as const) {
      const clave = `normalizar:${fuente}`;
      const f = fallosNormalizar[fuente];
      if (f.n > 0) {
        const mensaje = `${f.n} posts de ${fuente === "zernio" ? "Zernio" : "Meta"} no se pudieron normalizar (el primero: ${f.primero ?? "sin detalle"})`;
        errores.push(mensaje);
        await abrirAlerta(db, { clave, tipo: "normalizar", nivel: "aviso", mensaje });
      } else if ((fuente === "zernio" ? deps.zernio : deps.meta) !== undefined) {
        await resolverAlertas(db, [clave]);
      }
    }
    if (intentoMetricas) {
      if (erroresMetricas > 0) {
        await abrirAlerta(db, {
          clave: "meta:metricas",
          tipo: "metricas",
          nivel: "aviso",
          mensaje: `Meta rechazó ${erroresMetricas} métricas en esta corrida; esas cifras quedan en blanco.`,
        });
      } else {
        await resolverAlertas(db, ["meta:metricas"]);
      }
    }

    // 5b. Token vencido o sin permisos: según los errores que devolvió Meta en esta corrida.
    if (deps.meta) await alertasDeMeta(db, codigosMeta, metaLeida);

    // 6. Alertas de la cola (se calculan sobre lo guardado).
    await alertasDeCola(db, reloj(), colaOk);

    // 6b. Más de 24 h sin leer. Esta corrida cuenta como lectura si al menos un bloque salió bien.
    await alertaDeLectura(db, reloj(), bloques > 0 && bloquesFallidos < bloques);

    // 7. Cierre.
    const alertasAbiertas = await contarAbiertas(db);
    const hayFallos = bloquesFallidos > 0 || fallosNormalizar.zernio.n + fallosNormalizar.meta.n > 0;
    const estado: ResumenCorrida["estado"] =
      bloques > 0 && bloquesFallidos === bloques ? "error" : hayFallos || pendientes > 0 ? "parcial" : "ok";
    const resumen: ResumenCorrida = {
      estado,
      corridaId,
      publicacionesNuevas,
      lecturasNuevas,
      lecturasRepetidas,
      pendientes,
      alertasAbiertas,
      errores,
    };
    await cerrar(db, corridaId, resumen, reloj());
    return resumen;
  } catch (e) {
    // Algo inesperado (p. ej. la base): la corrida no puede quedar "en_curso" para siempre.
    errores.push(limpio(e));
    const resumen: ResumenCorrida = {
      estado: "error",
      corridaId,
      publicacionesNuevas,
      lecturasNuevas,
      lecturasRepetidas,
      pendientes,
      alertasAbiertas: 0,
      errores,
    };
    try {
      await cerrar(db, corridaId, resumen, reloj());
    } catch {
      // Si la base no responde, el candado se libera solo a los 10 minutos.
    }
    return resumen;
  }
}

async function cerrar(db: BaseDeDatos, id: number, r: ResumenCorrida, fin: Date): Promise<void> {
  const { errores, estado, ...conteos } = r;
  await db
    .update(corrida)
    .set({ estado, terminadaEn: fin, resumen: conteos, errores })
    .where(eq(corrida.id, id));
}

async function contarAbiertas(db: BaseDeDatos): Promise<number> {
  const [f] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(alerta)
    .where(isNull(alerta.resueltaEn));
  return f?.n ?? 0;
}

// ---------- Alertas de Meta y de lectura ----------

/** `meta:token` y `meta:permisos`: se abren con el error de la corrida y se cierran cuando Meta se lee sin él. */
async function alertasDeMeta(db: BaseDeDatos, codigos: ReadonlySet<number>, metaLeida: boolean): Promise<void> {
  const activas = new Map<string, AlertaNueva>();
  for (const c of codigos) {
    const a = alertaDeCodigoMeta(c);
    if (a) activas.set(a.clave, a);
  }
  for (const a of activas.values()) await abrirAlerta(db, a);
  // Si Meta ni siquiera respondió la lectura de cuentas por otro motivo, no se sabe si el problema sigue: no se cierra.
  if (!metaLeida) return;
  await resolverAlertas(
    db,
    [CLAVE_META_TOKEN, CLAVE_META_PERMISOS].filter((c) => !activas.has(c)),
  );
}

/** `lectura:atrasada`: la última corrida `ok` o `parcial` terminó hace más de 24 h (o nunca hubo). */
async function alertaDeLectura(db: BaseDeDatos, ahora: Date, estaCorridaLee: boolean): Promise<void> {
  let ultima: Date | null = ahora;
  if (!estaCorridaLee) {
    const [f] = await db
      .select({ fin: max(corrida.terminadaEn) })
      .from(corrida)
      .where(inArray(corrida.estado, ["ok", "parcial"]));
    ultima = f?.fin ? new Date(f.fin) : null;
  }
  const activas = alertaLecturaAtrasada(ahora, ultima);
  for (const a of activas) await abrirAlerta(db, a);
  if (activas.length === 0) await resolverAlertas(db, [CLAVE_LECTURA_ATRASADA]);
}

// ---------- Alertas de la cola ----------

/** Borrador que sale en menos de 24 h y publicaciones fallidas. Se cierran solas cuando dejan de cumplirse. */
async function alertasDeCola(db: BaseDeDatos, ahora: Date, colaOk: boolean): Promise<void> {
  const activas = new Map<string, AlertaNueva>();

  const borradores = await db
    .select()
    .from(publicacion)
    .where(
      and(
        eq(publicacion.estado, "borrador"),
        // Un borrador cuya hora ya pasó es todavía más urgente: se mantiene hasta un día después.
        gte(publicacion.programadoPara, new Date(ahora.getTime() - 24 * HORA)),
        lte(publicacion.programadoPara, new Date(ahora.getTime() + 24 * HORA)),
      ),
    );
  for (const p of borradores) {
    if (!p.programadoPara) continue;
    const nombre = p.reelId ? `El ${p.reelId}` : "Una publicación sin asignar";
    const verbo = p.programadoPara.getTime() >= ahora.getTime() ? "sale" : "debió salir";
    activas.set(`cola:${p.id}:sin-programar`, {
      clave: `cola:${p.id}:sin-programar`,
      tipo: "cola",
      nivel: "aviso",
      mensaje: `${nombre} sigue en borrador en ${NOMBRE_RED[p.red]} y ${verbo} ${cuando(p.programadoPara, ahora)}`,
      reelId: p.reelId,
      publicacionId: p.id,
    });
  }

  const fallidas = await db.select().from(publicacion).where(eq(publicacion.estado, "fallido"));
  for (const p of fallidas) {
    const nombre = p.reelId ? `El ${p.reelId}` : "Una publicación sin asignar";
    activas.set(`cola:${p.id}:fallida`, {
      clave: `cola:${p.id}:fallida`,
      tipo: "cola",
      nivel: "error",
      mensaje: `${nombre} falló al publicarse en ${NOMBRE_RED[p.red]}`,
      reelId: p.reelId,
      publicacionId: p.id,
    });
  }

  // T19: dobles, días sin video e IA sin etiqueta (puras, en alertas.ts).
  const todas: PublicacionParaAlertas[] = (await db.select().from(publicacion)).map((p) => ({
    id: p.id,
    red: p.red,
    estado: p.estado,
    reelId: p.reelId,
    programadoPara: p.programadoPara,
    marcaIa: p.marcaIa,
  }));
  const reels = await db.select({ id: reel.id, ia: reel.etiquetaIa }).from(reel);
  for (const a of alertasNuevasDeCola({
    ahora,
    publicaciones: todas,
    etiquetaIaPorReel: new Map(reels.map((r) => [r.id, r.ia])),
  })) {
    activas.set(a.clave, a);
  }

  for (const a of activas.values()) await abrirAlerta(db, a);

  // Si no se pudo leer la cola, lo guardado puede estar atrasado: no se cierra nada.
  if (!colaOk) return;
  const abiertas = await db
    .select({ clave: alerta.clave })
    .from(alerta)
    .where(and(like(alerta.clave, "cola:%"), isNull(alerta.resueltaEn)));
  await resolverAlertas(
    db,
    abiertas.map((a) => a.clave).filter((c) => !activas.has(c)),
  );
}
