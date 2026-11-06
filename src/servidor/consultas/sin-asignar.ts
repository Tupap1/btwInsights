// Pantalla /sin-asignar: publicaciones ya publicadas que no se pudieron unir a un reel.
import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { publicacion, reel } from "../db/esquema";
import type { Red } from "../tipos";

export interface PublicacionSinReel {
  id: number;
  red: Red;
  publicadoEn: Date | null;
  texto: string | null;
  enlace: string | null;
}

export interface ReelOpcion {
  id: string;
  gancho: string | null;
}

export async function consultarSinAsignar(
  db: BaseDeDatos,
): Promise<{ publicaciones: PublicacionSinReel[]; reels: ReelOpcion[] }> {
  const [publicaciones, reels] = await Promise.all([
    db
      .select({
        id: publicacion.id,
        red: publicacion.red,
        publicadoEn: publicacion.publicadoEn,
        texto: publicacion.texto,
        enlace: publicacion.enlace,
      })
      .from(publicacion)
      .where(and(isNull(publicacion.reelId), eq(publicacion.estado, "publicado")))
      .orderBy(desc(publicacion.publicadoEn)),
    db.select({ id: reel.id, gancho: reel.gancho }).from(reel).orderBy(asc(reel.id)),
  ]);
  return { publicaciones, reels };
}
