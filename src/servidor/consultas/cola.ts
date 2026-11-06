// Pantalla /cola: 14 días desde hoy, de día por red, con el estado de cada publicación y los avisos. Solo lectura.
import "server-only";
import type { BaseDeDatos } from "../db/cliente";
import type { EstadoPublicacion, Red } from "../tipos";
import { cargarDatos, NOMBRE_RED, REDES, type PublicacionFila, type ReelFila } from "./datos";
import { diaBogota, sumarDias } from "./tiempo";

export const DIAS_DE_COLA = 14;

export interface ItemCola {
  publicacionId: number;
  reelId: string | null;
  gancho: string | null;
  estado: EstadoPublicacion;
  momento: Date;
  enlace: string | null;
}

export interface AvisoCola {
  tipo: "doble" | "sin_video" | "fallida";
  dia: string;
  mensaje: string;
}

export interface DiaCola {
  dia: string;
  redes: Record<Red, ItemCola[]>;
  avisos: AvisoCola[];
}

export interface Cola {
  dias: DiaCola[];
  /** Avisos que no caen en un día de la ventana (p. ej. una fallida de hace unos días). */
  avisosFuera: AvisoCola[];
}

// Pendiente (no se inventa): "IA sin etiqueta" necesita la marca de IA que pone la plataforma, y hoy no se guarda.
// Cuando exista esa columna, aquí va el aviso "doble de IA" por publicación.

const NO_CUENTAN: readonly EstadoPublicacion[] = ["cancelado", "borrado"];

/** Arma la cola de 14 días. Pura: recibe las filas y el día de hoy en Bogotá ("AAAA-MM-DD"). */
export function armarCola(
  publicaciones: readonly PublicacionFila[],
  reels: readonly ReelFila[],
  hoy: string,
  dias: number = DIAS_DE_COLA,
): Cola {
  const lista: DiaCola[] = Array.from({ length: dias }, (_, i) => ({
    dia: sumarDias(hoy, i),
    redes: { tiktok: [], instagram: [], facebook: [] },
    avisos: [],
  }));
  const porDia = new Map(lista.map((d) => [d.dia, d]));
  const avisosFuera: AvisoCola[] = [];

  const ordenadas = publicaciones
    .filter((p) => !NO_CUENTAN.includes(p.estado))
    .map((p) => ({ p, momento: p.programadoPara ?? p.publicadoEn }))
    .filter((x): x is { p: PublicacionFila; momento: Date } => x.momento !== null)
    .sort((a, b) => a.momento.getTime() - b.momento.getTime());

  for (const { p, momento } of ordenadas) {
    const dia = diaBogota(momento);
    const gancho = reels.find((r) => r.id === p.reelId)?.gancho ?? (p.texto ? p.texto.slice(0, 60) : null);
    const nombre = p.reelId ? `el ${p.reelId}` : "una publicación sin reel";
    if (p.estado === "fallido") {
      const aviso: AvisoCola = { tipo: "fallida", dia, mensaje: `Falló ${nombre} en ${NOMBRE_RED[p.red]}.` };
      const d = porDia.get(dia);
      if (d) d.avisos.push(aviso);
      else if (dia >= sumarDias(hoy, -7)) avisosFuera.push(aviso);
    }
    const d = porDia.get(dia);
    if (!d) continue;
    d.redes[p.red].push({
      publicacionId: p.id,
      reelId: p.reelId,
      gancho,
      estado: p.estado,
      momento,
      enlace: p.enlace,
    });
  }

  for (const d of lista) {
    for (const red of REDES) {
      const items = d.redes[red].filter((i) => i.estado !== "fallido");
      if (items.length >= 2) {
        d.avisos.push({
          tipo: "doble",
          dia: d.dia,
          mensaje: `Dos videos el mismo día en ${NOMBRE_RED[red]}.`,
        });
      }
    }
    if (REDES.every((r) => d.redes[r].length === 0)) {
      d.avisos.push({ tipo: "sin_video", dia: d.dia, mensaje: "Día sin video." });
    }
  }
  return { dias: lista, avisosFuera };
}

export async function consultarCola(db: BaseDeDatos, ahora: Date): Promise<Cola> {
  const datos = await cargarDatos(db);
  return armarCola(datos.publicaciones, datos.reels, diaBogota(ahora));
}
