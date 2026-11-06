// Alertas que se calculan sobre lo guardado (T19). Funciones puras: reciben los datos y el instante actual
// y devuelven el conjunto de alertas que están activas AHORA, cada una con una clave estable.
// El recolector abre las que falten y cierra las abiertas que ya no estén (ver recolectar.ts).
//
// Claves:
//   lectura:atrasada                      más de 24 h sin una lectura buena
//   cola:<dia>:<red>:doble                dos o más videos el mismo día en la misma red
//   cola:<dia>:<red>:sin-video            día sin video en los próximos 7 (aviso: los domingos no se publica)
//   cola:<publicacionId>:ia-sin-etiqueta  el reel lleva IA y la publicación no está marcada
//   meta:token                            Meta respondió 190 (token vencido o inválido)
//   meta:permisos                         Meta respondió 10 o 200 (faltan permisos)
import type { AlertaNueva } from "../guardar";
import type { EstadoPublicacion, Red } from "../tipos";

const HORA = 3_600_000;
const DIA = 24 * HORA;
const DESFASE_BOGOTA_MS = 5 * HORA;
const REDES: readonly Red[] = ["tiktok", "instagram", "facebook"];
const NOMBRE_RED: Record<Red, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };
/** Estados que no cuentan como "un video ese día". */
const NO_CUENTAN: ReadonlySet<EstadoPublicacion> = new Set(["cancelado", "borrado"]);
const ESTADOS_IA: ReadonlySet<EstadoPublicacion> = new Set(["borrador", "pendiente_aprobacion", "programado"]);

export const HORAS_SIN_LEER_MAX = 24;
export const DIAS_DOBLE = 14;
export const DIAS_SIN_VIDEO = 7;

export const CLAVE_LECTURA_ATRASADA = "lectura:atrasada";
export const CLAVE_META_TOKEN = "meta:token";
export const CLAVE_META_PERMISOS = "meta:permisos";

export interface PublicacionParaAlertas {
  id: number;
  red: Red;
  estado: EstadoPublicacion;
  reelId: string | null;
  programadoPara: Date | null;
  marcaIa: boolean | null;
}

export interface EntradaAlertasCola {
  ahora: Date;
  publicaciones: readonly PublicacionParaAlertas[];
  /** `reel.etiquetaIa` por id de reel (null = no se sabe). */
  etiquetaIaPorReel: ReadonlyMap<string, boolean | null>;
}

export const diaBogota = (f: Date): string => new Date(f.getTime() - DESFASE_BOGOTA_MS).toISOString().slice(0, 10);

const sumarDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);

const fmtHora = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Bogota",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const nombreReel = (reelId: string | null): string => (reelId ? `el ${reelId}` : "una publicación sin asignar");

/** 1. Más de 24 h sin leer. `ultimaLectura` = fin de la última corrida `ok` o `parcial` (null si nunca hubo). */
export function alertaLecturaAtrasada(ahora: Date, ultimaLectura: Date | null): AlertaNueva[] {
  if (ultimaLectura !== null && ahora.getTime() - ultimaLectura.getTime() <= HORAS_SIN_LEER_MAX * HORA) return [];
  const mensaje =
    ultimaLectura === null
      ? "El tablero nunca ha leído las redes (no hay ninguna corrida buena)."
      : `Hace más de 24 horas que no se leen las redes: la última lectura buena fue el ${diaBogota(ultimaLectura)} a las ${fmtHora.format(ultimaLectura)} (hora de Bogotá).`;
  return [{ clave: CLAVE_LECTURA_ATRASADA, tipo: "lectura", nivel: "error", mensaje }];
}

/** 2. Dos o más videos el mismo día (de Bogotá) en la misma red, en los próximos 14 días. */
export function alertasDobles(e: EntradaAlertasCola): AlertaNueva[] {
  const hoy = diaBogota(e.ahora);
  const hasta = sumarDias(hoy, DIAS_DOBLE - 1);
  const grupos = new Map<string, PublicacionParaAlertas[]>();
  for (const p of e.publicaciones) {
    if (NO_CUENTAN.has(p.estado) || !p.programadoPara) continue;
    const dia = diaBogota(p.programadoPara);
    if (dia < hoy || dia > hasta) continue;
    const k = `${dia}|${p.red}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  const salida: AlertaNueva[] = [];
  for (const [k, ps] of grupos) {
    if (ps.length < 2) continue;
    const [dia, red] = k.split("|") as [string, Red];
    const detalle = ps
      .sort((a, b) => (a.programadoPara?.getTime() ?? 0) - (b.programadoPara?.getTime() ?? 0))
      .map((p) => `${nombreReel(p.reelId)} a las ${p.programadoPara ? fmtHora.format(p.programadoPara) : "?"}`)
      .join(" y ");
    salida.push({
      clave: `cola:${dia}:${red}:doble`,
      tipo: "cola",
      nivel: "aviso",
      mensaje: `Hay ${ps.length} videos el ${dia} en ${NOMBRE_RED[red]}: ${detalle}.`,
    });
  }
  return salida;
}

/** 3. Día sin video en los próximos 7 días, por red. Solo avisa: no todos los días ni redes se programan. */
export function alertasSinVideo(e: EntradaAlertasCola): AlertaNueva[] {
  const hoy = diaBogota(e.ahora);
  const cubiertos = new Set<string>();
  for (const p of e.publicaciones) {
    if (NO_CUENTAN.has(p.estado) || !p.programadoPara) continue;
    cubiertos.add(`${diaBogota(p.programadoPara)}|${p.red}`);
  }
  const salida: AlertaNueva[] = [];
  for (let i = 0; i < DIAS_SIN_VIDEO; i += 1) {
    const dia = sumarDias(hoy, i);
    for (const red of REDES) {
      if (cubiertos.has(`${dia}|${red}`)) continue;
      salida.push({
        clave: `cola:${dia}:${red}:sin-video`,
        tipo: "cola",
        nivel: "aviso",
        mensaje: `No hay ningún video programado para el ${dia} en ${NOMBRE_RED[red]}.`,
      });
    }
  }
  return salida;
}

/** 5. El reel lleva IA y la publicación futura (borrador o programada) no está marcada como hecha con IA. */
export function alertasIaSinEtiqueta(e: EntradaAlertasCola): AlertaNueva[] {
  const salida: AlertaNueva[] = [];
  for (const p of e.publicaciones) {
    if (!p.reelId || !ESTADOS_IA.has(p.estado) || !p.programadoPara) continue;
    if (p.programadoPara.getTime() <= e.ahora.getTime()) continue;
    if (e.etiquetaIaPorReel.get(p.reelId) !== true) continue;
    if (p.marcaIa === true) continue;
    const cuando = `${diaBogota(p.programadoPara)} a las ${fmtHora.format(p.programadoPara)}`;
    salida.push({
      clave: `cola:${p.id}:ia-sin-etiqueta`,
      tipo: "cola",
      nivel: "aviso",
      mensaje: `El ${p.reelId} lleva IA y su publicación en ${NOMBRE_RED[p.red]} (${cuando}) no está marcada como hecha con IA${p.marcaIa === null ? " (Zernio no dio la marca)" : ""}.`,
      reelId: p.reelId,
      publicacionId: p.id,
    });
  }
  return salida;
}

/** Las alertas de la cola (2, 3 y 5): todas con clave `cola:...`. */
export function alertasNuevasDeCola(e: EntradaAlertasCola): AlertaNueva[] {
  return [...alertasDobles(e), ...alertasSinVideo(e), ...alertasIaSinEtiqueta(e)];
}

/** 4. Un código de error de Meta → la alerta que le toca (o null si no es de token ni de permisos). */
export function alertaDeCodigoMeta(codigo: number | undefined): AlertaNueva | null {
  if (codigo === 190) {
    return {
      clave: CLAVE_META_TOKEN,
      tipo: "meta",
      nivel: "error",
      mensaje: "Meta rechazó el token (vencido o inválido, código 190). Hay que generar uno nuevo.",
    };
  }
  if (codigo === 10 || codigo === 200) {
    return {
      clave: CLAVE_META_PERMISOS,
      tipo: "meta",
      nivel: "error",
      mensaje: `Meta dice que al token le faltan permisos (código ${codigo}). Hay que revisar los permisos de la app.`,
    };
  }
  return null;
}
