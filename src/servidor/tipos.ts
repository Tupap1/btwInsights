// Tipos del dominio que comparten las fuentes, la normalización, el emparejamiento y la importación.
// Regla: null = la fuente no dio el dato. Nunca 0 en su lugar.

export type Red = "tiktok" | "instagram" | "facebook";
export type Fuente = "meta" | "zernio" | "manual";
export type Via = "api" | "csv" | "timeline" | "captura";
export type EstadoPublicacion =
  | "borrador"
  | "pendiente_aprobacion"
  | "programado"
  | "publicando"
  | "publicado"
  | "parcial"
  | "fallido"
  | "cancelado"
  | "borrado";
export type OrigenPublicacion = "zernio" | "meta" | "manual";
export type EmparejadoPor = "id" | "etiqueta" | "fecha_texto" | "manual";
export type Formato = "la_cuenta" | "dialogo" | "prueba_real" | "plata_3d" | "pantalla_dividida" | "otro";
export type Voz = "fernando" | "andres" | "andres_voice_changer" | "sin_voz" | "otra";

/** Una publicación tal como la ve una fuente, antes de emparejarla con un reel. */
export interface PublicacionVista {
  red: Red;
  origen: OrigenPublicacion;
  cuenta: string | null;
  postIdPlataforma: string | null;
  zernioPostId: string | null;
  /** Etiquetas de Zernio, p. ej. ["reel-14"]. */
  etiquetas: string[];
  enlace: string | null;
  texto: string | null;
  duracionS: number | null;
  programadoPara: Date | null;
  publicadoEn: Date | null;
  estado: EstadoPublicacion;
  /** Marca de "hecho con IA" que tiene el borrador en Zernio. Ausente o null = la fuente no la dio. */
  marcaIa?: boolean | null;
}

/** Cifras de una publicación en un momento. Los porcentajes van de 0 a 100 y los tiempos en segundos. */
export interface Cifras {
  vistas: number | null;
  alcance: number | null;
  meGusta: number | null;
  comentarios: number | null;
  compartidos: number | null;
  guardados: number | null;
  seguidoresGanados: number | null;
  visitasPerfil: number | null;
  interacciones: number | null;
  reproduccionesConRepeticion: number | null;
  completos: number | null;
  tiempoPromedioS: number | null;
  tiempoTotalS: number | null;
  pctCompleto: number | null;
  pctSalta3s: number | null;
  ret1s: number | null;
  ret3s: number | null;
  ret5s: number | null;
  ret10s: number | null;
  pctParaTi: number | null;
  pctBusqueda: number | null;
  pctNoSeguidores: number | null;
}

/** Una lectura de UNA fuente. Si Meta y Zernio dan cifras del mismo post, son dos lecturas distintas. */
export interface LecturaVista {
  fuente: Fuente;
  via: Via;
  /** Cuándo estaba vigente el dato (Meta: al leer; Zernio: su lastUpdated). */
  datoActualizadoEn: Date;
  cifras: Cifras;
  /** Facebook: reacciones por tipo tal como llegan. */
  reacciones: Record<string, number> | null;
  paisPrincipal: { codigo: string; pct: number } | null;
  /** Curva de retención: segundo → porcentaje 0-100, solo los puntos que llegaron. */
  curva: Record<string, number> | null;
  /** Errores por métrica (p. ej. Meta rechazó una), sin URL ni llaves. */
  errores: string[];
}

/** Resultado de pedir métricas de insights a Meta: por nombre, el valor crudo o el error (sin URL ni token). */
export type MetricasMeta = Record<string, { ok: true; valor: unknown } | { ok: false; error: string }>;

/** Lo que se sabe de un reel para emparejarle publicaciones. */
export interface ReelCandidato {
  id: string;
  /** Fechas (AAAA-MM-DD, Bogotá) en que pudo salir: la del plan y las que anotó Andrés. */
  fechas: string[];
  /** Textos conocidos: el de TikTok, el de Facebook e Instagram y el gancho. */
  textos: string[];
  /** Duraciones conocidas de sus archivos (la versión de TikTok y la de Meta pueden diferir). */
  duracionesS: number[];
}

/** Lo que una fuente devuelve de un post: la publicación y, si hay, su lectura. */
export interface PostLeido {
  publicacion: PublicacionVista;
  lectura: LecturaVista | null;
}

export const cifrasVacias = (): Cifras => ({
  vistas: null,
  alcance: null,
  meGusta: null,
  comentarios: null,
  compartidos: null,
  guardados: null,
  seguidoresGanados: null,
  visitasPerfil: null,
  interacciones: null,
  reproduccionesConRepeticion: null,
  completos: null,
  tiempoPromedioS: null,
  tiempoTotalS: null,
  pctCompleto: null,
  pctSalta3s: null,
  ret1s: null,
  ret3s: null,
  ret5s: null,
  ret10s: null,
  pctParaTi: null,
  pctBusqueda: null,
  pctNoSeguidores: null,
});
