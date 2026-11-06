// Escribe en la base lo que leen las fuentes. Lo usan la importación y el recolector.
// Reglas:
//   - una publicación se reconoce por su id de Zernio o por (red, id de la plataforma): nunca se duplica;
//   - un dato conocido no se pisa con null;
//   - una asignación a mano nunca se cambia sola, y una automática solo se mejora con una más segura;
//   - una lectura repetida (misma publicación, fuente, vía y momento del dato) se ignora;
//   - nada se borra.
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { BaseDeDatos } from "./db/cliente";
import { alerta, cuentaLectura, curvaRetencion, lectura, publicacion } from "./db/esquema";
import type { CuentaLeida } from "./normalizar/zernio";
import type { EmparejadoPor, LecturaVista, PublicacionVista } from "./tipos";

export interface Emparejamiento {
  reelId: string | null;
  por: EmparejadoPor | null;
}

/** De menos a más segura. */
const PRIORIDAD: Record<EmparejadoPor, number> = { fecha_texto: 1, etiqueta: 2, id: 3, manual: 4 };

type FilaPublicacion = typeof publicacion.$inferSelect;

async function buscar(db: BaseDeDatos, p: PublicacionVista): Promise<FilaPublicacion | undefined> {
  if (p.zernioPostId) {
    const [f] = await db.select().from(publicacion).where(eq(publicacion.zernioPostId, p.zernioPostId)).limit(1);
    if (f) return f;
  }
  if (p.postIdPlataforma) {
    const [f] = await db
      .select()
      .from(publicacion)
      .where(and(eq(publicacion.red, p.red), eq(publicacion.postIdPlataforma, p.postIdPlataforma)))
      .limit(1);
    if (f) return f;
  }
  return undefined;
}

/** Los campos de la publicación que trae la fuente, sin los null (para no borrar lo que ya se sabía). */
function camposConocidos(p: PublicacionVista) {
  const c = {
    cuenta: p.cuenta,
    postIdPlataforma: p.postIdPlataforma,
    zernioPostId: p.zernioPostId,
    enlace: p.enlace,
    texto: p.texto,
    duracionS: p.duracionS,
    programadoPara: p.programadoPara,
    publicadoEn: p.publicadoEn,
  };
  return Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null)) as Partial<typeof c>;
}

/** Crea o actualiza la publicación. Devuelve su id y el reel con que quedó. */
export async function guardarPublicacion(
  db: BaseDeDatos,
  p: PublicacionVista,
  e: Emparejamiento,
): Promise<{ id: number; nueva: boolean; reelId: string | null }> {
  const existente = await buscar(db, p);
  // "fecha_texto" es la regla menos segura: no se usa si el reel ya tiene otra publicación publicada en esa red.
  if (e.reelId && e.por === "fecha_texto") {
    const [otra] = await db
      .select({ id: publicacion.id })
      .from(publicacion)
      .where(
        and(
          eq(publicacion.red, p.red),
          eq(publicacion.reelId, e.reelId),
          inArray(publicacion.estado, ["publicado", "parcial", "publicando"]),
          existente ? ne(publicacion.id, existente.id) : undefined,
        ),
      )
      .limit(1);
    if (otra) e = { reelId: null, por: null };
  }
  if (!existente) {
    const [f] = await db
      .insert(publicacion)
      .values({
        red: p.red,
        origen: p.origen,
        estado: p.estado,
        etiquetas: p.etiquetas,
        ...camposConocidos(p),
        reelId: e.reelId,
        emparejadoPor: e.reelId ? e.por : null,
      })
      .returning({ id: publicacion.id, reelId: publicacion.reelId });
    if (!f) throw new Error("No se pudo crear la publicación.");
    return { id: f.id, nueva: true, reelId: f.reelId };
  }

  const actual = existente.emparejadoPor ? PRIORIDAD[existente.emparejadoPor] : 0;
  const nueva = e.reelId && e.por ? PRIORIDAD[e.por] : 0;
  const mejora = nueva > actual;
  const [f] = await db
    .update(publicacion)
    .set({
      ...camposConocidos(p),
      estado: p.estado,
      etiquetas: p.etiquetas.length ? p.etiquetas : existente.etiquetas,
      ...(mejora ? { reelId: e.reelId, emparejadoPor: e.por } : {}),
      actualizadoEn: new Date(),
    })
    .where(eq(publicacion.id, existente.id))
    .returning({ id: publicacion.id, reelId: publicacion.reelId });
  if (!f) throw new Error("No se pudo actualizar la publicación.");
  return { id: f.id, nueva: false, reelId: f.reelId };
}

/** Guarda una lectura y su curva. Devuelve false si ya existía (mismo dato). */
export async function guardarLectura(
  db: BaseDeDatos,
  publicacionId: number,
  publicadoEn: Date | null,
  l: LecturaVista,
  leidoEn: Date,
  nota?: string,
): Promise<boolean> {
  const horas = publicadoEn ? (l.datoActualizadoEn.getTime() - publicadoEn.getTime()) / 3_600_000 : null;
  const insertadas = await db
    .insert(lectura)
    .values({
      publicacionId,
      fuente: l.fuente,
      via: l.via,
      leidoEn,
      datoActualizadoEn: l.datoActualizadoEn,
      horasDesdePublicacion: horas === null ? null : Math.round(horas * 100) / 100,
      ...l.cifras,
      reacciones: l.reacciones,
      paisPrincipal: l.paisPrincipal?.codigo ?? null,
      paisPrincipalPct: l.paisPrincipal?.pct ?? null,
      nota: nota ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: lectura.id });
  if (l.curva && Object.keys(l.curva).length) {
    await db
      .insert(curvaRetencion)
      .values({ publicacionId, fuente: l.fuente, leidoEn, datoActualizadoEn: l.datoActualizadoEn, puntos: l.curva })
      .onConflictDoNothing();
  }
  return insertadas.length > 0;
}

export async function guardarCuenta(db: BaseDeDatos, c: CuentaLeida): Promise<void> {
  await db
    .insert(cuentaLectura)
    .values({ red: c.red, cuenta: c.cuenta ?? c.red, fuente: c.fuente, leidoEn: c.leidoEn, seguidores: c.seguidores, publicaciones: c.publicaciones })
    .onConflictDoNothing();
}

export interface AlertaNueva {
  /** Identifica el problema; mientras siga abierta no se repite. */
  clave: string;
  tipo: string;
  nivel?: "info" | "aviso" | "error";
  mensaje: string;
  reelId?: string | null;
  publicacionId?: number | null;
}

/** Abre una alerta si no hay otra abierta con la misma clave. */
export async function abrirAlerta(db: BaseDeDatos, a: AlertaNueva): Promise<void> {
  await db
    .insert(alerta)
    .values({ clave: a.clave, tipo: a.tipo, nivel: a.nivel ?? "aviso", mensaje: a.mensaje, reelId: a.reelId ?? null, publicacionId: a.publicacionId ?? null })
    .onConflictDoNothing({ target: alerta.clave, where: sql`${alerta.resueltaEn} is null` });
}

/** Cierra las alertas abiertas con esas claves (el problema ya no está). */
export async function resolverAlertas(db: BaseDeDatos, claves: readonly string[]): Promise<void> {
  if (!claves.length) return;
  await db
    .update(alerta)
    .set({ resueltaEn: new Date() })
    .where(and(inArray(alerta.clave, [...claves]), isNull(alerta.resueltaEn)));
}
