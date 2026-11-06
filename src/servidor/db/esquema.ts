// Esquema de Postgres (Drizzle). Solo Postgres estándar: corre igual en el contenedor local y en Neon.
// Regla de los datos: cada cifra guarda su fuente (meta, zernio o manual) y la fecha en que el dato estaba vigente.
// Un dato que la fuente no dio queda en NULL: nunca se rellena ni se interpola.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ahora = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const momento = () => timestamp({ withTimezone: true });

// ---------- Enumeraciones ----------
export const red = pgEnum("red", ["tiktok", "instagram", "facebook"]);
export const fuente = pgEnum("fuente", ["meta", "zernio", "manual"]);
/** Cómo llegó una lectura: por la API, importada de un CSV viejo, reconstruida del historial diario o de una captura. */
export const via = pgEnum("via", ["api", "csv", "timeline", "captura"]);
export const estadoReel = pgEnum("estado_reel", ["idea", "guion", "produccion", "listo", "archivado"]);
export const formato = pgEnum("formato", ["la_cuenta", "dialogo", "prueba_real", "plata_3d", "pantalla_dividida", "otro"]);
export const voz = pgEnum("voz", ["fernando", "andres", "andres_voice_changer", "sin_voz", "otra"]);
export const estadoPublicacion = pgEnum("estado_publicacion", [
  "borrador",
  "pendiente_aprobacion",
  "programado",
  "publicando",
  "publicado",
  "parcial",
  "fallido",
  "cancelado",
  "borrado",
]);
export const origenPublicacion = pgEnum("origen_publicacion", ["zernio", "meta", "manual"]);
/** Cómo se unió la publicación a su reel. NULL en la columna = "Sin asignar". */
export const emparejadoPor = pgEnum("emparejado_por", ["id", "etiqueta", "fecha_texto", "manual"]);
export const nivelAlerta = pgEnum("nivel_alerta", ["info", "aviso", "error"]);
export const estadoCorrida = pgEnum("estado_corrida", ["en_curso", "ok", "parcial", "error", "abandonada"]);
export const origenCorrida = pgEnum("origen_corrida", ["cli", "http", "boton"]);

// ---------- Catálogo ----------
export const reel = pgTable("reel", {
  /** Texto: "14", "09b", "04C-G1", "TERROR02". */
  id: text().primaryKey(),
  slug: text(),
  /** Carpeta dentro de btw-videos/publicar/, si tiene. */
  carpeta: text(),
  gancho: text(),
  formato: formato(),
  /** Lo que dice seguimiento.csv tal cual (columnas prueba y cuerpo). */
  formatoDetalle: text(),
  voz: voz(),
  vozDetalle: text(),
  etiquetaIa: boolean(),
  duracionS: doublePrecision(),
  /** Puntaje del guion sobre 12 (lista de chequeo de guiones.md). */
  puntajeGuion: integer(),
  variablesProbadas: text(),
  guion: text(),
  textoTiktok: text(),
  textoMeta: text(),
  comentarioFijado: text(),
  /** Avisos de la sección "ANTES DE PUBLICAR" de texto.txt. */
  avisos: text().array().notNull().default(sql`'{}'::text[]`),
  fechaPlan: date({ mode: "string" }),
  estado: estadoReel().notNull().default("idea"),
  notas: text(),
  creadoEn: ahora(),
  actualizadoEn: ahora(),
});

// ---------- Publicaciones (un reel en una red) ----------
export const publicacion = pgTable(
  "publicacion",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    reelId: text().references(() => reel.id, { onUpdate: "cascade" }),
    red: red().notNull(),
    cuenta: text(),
    postIdPlataforma: text(),
    zernioPostId: text(),
    etiquetas: text().array().notNull().default(sql`'{}'::text[]`),
    enlace: text(),
    texto: text(),
    duracionS: doublePrecision(),
    programadoPara: momento(),
    publicadoEn: momento(),
    estado: estadoPublicacion().notNull(),
    origen: origenPublicacion().notNull(),
    emparejadoPor: emparejadoPor(),
    /**
     * Marca de IA que trae el borrador en la plataforma (Zernio: tiktokSettings.video_made_with_ai o
     * platformSpecificData.isAiGenerated). NULL = la fuente no la dio. Se compara con reel.etiquetaIa (T19).
     */
    marcaIa: boolean(),
    creadoEn: ahora(),
    actualizadoEn: ahora(),
  },
  (t) => [
    // NULL no choca con NULL en un índice único de Postgres: un borrador sin id de plataforma no estorba.
    uniqueIndex("publicacion_red_post_unico").on(t.red, t.postIdPlataforma),
    uniqueIndex("publicacion_zernio_unico").on(t.zernioPostId),
    index("publicacion_reel_idx").on(t.reelId),
  ],
);

// ---------- Lecturas (cifras de una publicación en un momento, de UNA fuente) ----------
export const lectura = pgTable(
  "lectura",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    publicacionId: integer()
      .notNull()
      .references(() => publicacion.id),
    fuente: fuente().notNull(),
    via: via().notNull(),
    /** Cuándo la leyó el tablero. */
    leidoEn: momento().notNull(),
    /** Cuándo estaba vigente el dato: Meta = al leer; Zernio = su lastUpdated; timeline = el día. */
    datoActualizadoEn: momento().notNull(),
    horasDesdePublicacion: doublePrecision(),
    vistas: integer(),
    alcance: integer(),
    meGusta: integer(),
    comentarios: integer(),
    compartidos: integer(),
    guardados: integer(),
    seguidoresGanados: integer(),
    visitasPerfil: integer(),
    interacciones: integer(),
    /** Facebook: fb_reels_total_plays (cuenta repeticiones). */
    reproduccionesConRepeticion: integer(),
    /** Facebook: total_video_complete_views. */
    completos: integer(),
    /** Facebook: reacciones por tipo, tal cual llegan ({"REACTION_LIKE": 2}). */
    reacciones: jsonb().$type<Record<string, number>>(),
    tiempoPromedioS: doublePrecision(),
    tiempoTotalS: doublePrecision(),
    /** Porcentajes de 0 a 100. */
    pctCompleto: doublePrecision(),
    pctSalta3s: doublePrecision(),
    ret1s: doublePrecision(),
    ret3s: doublePrecision(),
    ret5s: doublePrecision(),
    ret10s: doublePrecision(),
    pctParaTi: doublePrecision(),
    pctBusqueda: doublePrecision(),
    pctNoSeguidores: doublePrecision(),
    paisPrincipal: text(),
    paisPrincipalPct: doublePrecision(),
    nota: text(),
    creadoEn: ahora(),
  },
  (t) => [
    // Si Zernio no ha vuelto a sincronizar, su lastUpdated no cambia y la lectura no se duplica.
    uniqueIndex("lectura_unica").on(t.publicacionId, t.fuente, t.via, t.datoActualizadoEn),
    index("lectura_publicacion_idx").on(t.publicacionId, t.datoActualizadoEn),
  ],
);

/** Curva de retención tal como llega: {"segundo": porcentaje 0-100}. Sin interpolar. */
export const curvaRetencion = pgTable(
  "curva_retencion",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    publicacionId: integer()
      .notNull()
      .references(() => publicacion.id),
    fuente: fuente().notNull(),
    leidoEn: momento().notNull(),
    datoActualizadoEn: momento().notNull(),
    puntos: jsonb().$type<Record<string, number>>().notNull(),
  },
  (t) => [uniqueIndex("curva_unica").on(t.publicacionId, t.fuente, t.datoActualizadoEn)],
);

export const cuentaLectura = pgTable(
  "cuenta_lectura",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    red: red().notNull(),
    cuenta: text().notNull(),
    fuente: fuente().notNull(),
    leidoEn: momento().notNull(),
    seguidores: integer(),
    publicaciones: integer(),
  },
  (t) => [uniqueIndex("cuenta_lectura_unica").on(t.red, t.cuenta, t.fuente, t.leidoEn)],
);

// ---------- Operación ----------
export const alerta = pgTable(
  "alerta",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Identifica el problema ("fuente:meta:token", "cola:14:tiktok:sin-programar") para no repetirlo abierto. */
    clave: text().notNull(),
    tipo: text().notNull(),
    nivel: nivelAlerta().notNull().default("aviso"),
    mensaje: text().notNull(),
    reelId: text().references(() => reel.id, { onUpdate: "cascade" }),
    publicacionId: integer().references(() => publicacion.id),
    creadaEn: ahora(),
    resueltaEn: momento(),
  },
  (t) => [uniqueIndex("alerta_abierta_unica").on(t.clave).where(sql`${t.resueltaEn} is null`)],
);

/** Cada ejecución del recolector. Solo puede haber una "en_curso" a la vez. */
export const corrida = pgTable(
  "corrida",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    origen: origenCorrida().notNull(),
    estado: estadoCorrida().notNull().default("en_curso"),
    iniciadaEn: ahora(),
    terminadaEn: momento(),
    resumen: jsonb().$type<Record<string, unknown>>(),
    errores: jsonb().$type<string[]>(),
  },
  (t) => [uniqueIndex("corrida_una_en_curso").on(t.estado).where(sql`${t.estado} = 'en_curso'`)],
);

// ---------- Fase 2 (las tablas existen desde ya; sus pantallas vienen después) ----------
export const idea = pgTable(
  "idea",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    titulo: text().notNull(),
    gancho: text(),
    formato: formato(),
    funcionBtwash: text(),
    verificadaEnCodigo: boolean().notNull().default(false),
    puntaje: integer(),
    estado: text().notNull().default("nueva"),
    /** De dónde salió: "<archivo>#<fila o encabezado>". Única, para que re-importar no duplique (T16). */
    fuente: text(),
    reelId: text().references(() => reel.id, { onUpdate: "cascade" }),
    creadaEn: ahora(),
  },
  (t) => [uniqueIndex("idea_fuente_unica").on(t.fuente)],
);

export const lead = pgTable("lead", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  fecha: date({ mode: "string" }).notNull(),
  canal: text().notNull(),
  reelId: text().references(() => reel.id, { onUpdate: "cascade" }),
  nota: text(),
  resultado: text(),
  creadoEn: ahora(),
});

// ---------- Comentarios del inbox de Zernio (T22) ----------
// Privacidad: de quien comenta solo se guarda el @ (autor_usuario). Nunca su nombre, su id ni su foto.
export const comentario = pgTable(
  "comentario",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    publicacionId: integer()
      .notNull()
      .references(() => publicacion.id),
    red: red().notNull(),
    idPlataforma: text().notNull(),
    /** NULL en los comentarios de primer nivel. */
    padreIdPlataforma: text(),
    /** Vacío si el comentario es solo imagen. */
    texto: text().notNull(),
    /** El @ de quien comenta (from.username). NULL si no vino. */
    autorUsuario: text(),
    /** El comentario es de la propia cuenta. */
    esPropio: boolean().notNull().default(false),
    creadoEn: momento(),
    meGusta: integer(),
    /** replyCount de la plataforma (puede ser mayor que las respuestas guardadas). */
    respuestas: integer(),
    oculto: boolean().notNull().default(false),
    enlace: text(),
    /** La primera vez que el tablero lo vio. */
    leidoEn: ahora(),
    actualizadoEn: ahora(),
    /** Se llena si una lectura completa del hilo ya no lo trae. Nada se borra. */
    desaparecioEn: momento(),
  },
  (t) => [
    uniqueIndex("comentario_red_id_unico").on(t.red, t.idPlataforma),
    index("comentario_publicacion_idx").on(t.publicacionId),
  ],
);

/** Estado de lectura del hilo de cada publicación: sirve para no volver a pedir hilos que no cambiaron. */
export const hiloComentarios = pgTable("hilo_comentarios", {
  publicacionId: integer()
    .primaryKey()
    .references(() => publicacion.id),
  /** El commentCount de la lista cuando se leyó el hilo. NULL = la lista no lo dio. */
  conteoFuente: integer(),
  /** La lectura trajo todas las páginas del hilo. */
  completo: boolean().notNull(),
  leidoEn: momento().notNull(),
});

// ---------- Acceso (T09) ----------
// Nunca se guarda un token en claro: sesión e invitación guardan su sha256 en hexadecimal.
export const tipoDesafio = pgEnum("tipo_desafio", ["registro", "entrada"]);

export const usuario = pgTable("usuario", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  nombre: text().notNull().unique(),
  /** Identificador estable para WebAuthn: aleatorio, base64url, sin relación con el nombre. */
  idWebauthn: text().notNull().unique(),
  activo: boolean().notNull().default(true),
  creadoEn: ahora(),
});

export const credencial = pgTable(
  "credencial",
  {
    /** El credentialID en base64url. */
    id: text().primaryKey(),
    usuarioId: integer()
      .notNull()
      .references(() => usuario.id),
    /** Clave pública COSE en base64url. */
    clavePublica: text().notNull(),
    contador: bigint({ mode: "number" }).notNull().default(0),
    transportes: text().array(),
    creadaEn: ahora(),
    usadaEn: momento(),
  },
  (t) => [index("credencial_usuario_idx").on(t.usuarioId)],
);

export const sesion = pgTable(
  "sesion",
  {
    /** sha256 (hex) del token de la cookie. */
    hash: text().primaryKey(),
    usuarioId: integer()
      .notNull()
      .references(() => usuario.id),
    creadaEn: ahora(),
    expiraEn: timestamp({ withTimezone: true }).notNull(),
    usadaEn: momento(),
  },
  (t) => [index("sesion_usuario_idx").on(t.usuarioId)],
);

export const invitacion = pgTable(
  "invitacion",
  {
    /** sha256 (hex) del token del enlace. */
    hash: text().primaryKey(),
    usuarioId: integer()
      .notNull()
      .references(() => usuario.id),
    creadaEn: ahora(),
    expiraEn: timestamp({ withTimezone: true }).notNull(),
    usadaEn: momento(),
  },
  (t) => [index("invitacion_usuario_idx").on(t.usuarioId)],
);

export const desafio = pgTable("desafio", {
  /** Aleatorio; va en la cookie btw_desafio. */
  id: text().primaryKey(),
  reto: text().notNull(),
  tipo: tipoDesafio().notNull(),
  usuarioId: integer().references(() => usuario.id),
  expiraEn: timestamp({ withTimezone: true }).notNull(),
});
