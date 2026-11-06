// Carga de la base que comparten las consultas. Son pocas filas (decenas de reels, cientos de lecturas):
// se leen enteras y se resuelven en memoria con las funciones puras de cifras.ts.
import "server-only";
import { asc } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { lectura, publicacion, reel } from "../db/esquema";
import type { Red } from "../tipos";
import type { LecturaDato } from "./cifras";

export type ReelFila = typeof reel.$inferSelect;
export type PublicacionFila = typeof publicacion.$inferSelect;

export interface Datos {
  reels: ReelFila[];
  publicaciones: PublicacionFila[];
  lecturasPorPublicacion: Map<number, LecturaDato[]>;
}

export async function cargarDatos(db: BaseDeDatos): Promise<Datos> {
  const [reels, publicaciones, lecturas] = await Promise.all([
    db.select().from(reel),
    db.select().from(publicacion),
    db.select().from(lectura).orderBy(asc(lectura.datoActualizadoEn)),
  ]);
  const lecturasPorPublicacion = new Map<number, LecturaDato[]>();
  for (const l of lecturas) {
    const lista = lecturasPorPublicacion.get(l.publicacionId) ?? [];
    lista.push(l);
    lecturasPorPublicacion.set(l.publicacionId, lista);
  }
  return { reels, publicaciones, lecturasPorPublicacion };
}

export const REDES: readonly Red[] = ["tiktok", "instagram", "facebook"];
export const NOMBRE_RED: Record<Red, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };

export type PublicacionSalida = PublicacionFila & { publicadoEn: Date };

/** Una publicación que ya salió y tiene fecha de salida. */
export function estaPublicada(p: PublicacionFila): p is PublicacionSalida {
  return (p.estado === "publicado" || p.estado === "parcial") && p.publicadoEn !== null;
}

/** Las publicadas de una red, de la más reciente a la más vieja. */
export function publicadasDeRed(pubs: readonly PublicacionFila[], red: Red): PublicacionSalida[] {
  return pubs
    .filter((p) => p.red === red)
    .filter(estaPublicada)
    .sort((a, b) => b.publicadoEn.getTime() - a.publicadoEn.getTime());
}
