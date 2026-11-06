// Lee calendario-zernio.json (los borradores que se crearon en Zernio). Función pura: recibe el JSON ya parseado.
// Colombia no tiene horario de verano, así que America/Bogota es siempre -05:00.

import { z } from "zod";

const FORMA_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FORMA_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esquemaFecha = z
  .string()
  .regex(FORMA_FECHA, "la fecha debe ser AAAA-MM-DD")
  .refine((f) => new Date(`${f}T00:00:00Z`).toISOString().slice(0, 10) === f, "la fecha no existe");

const esquemaVideo = z.object({
  id: z.string().min(1),
  carpeta: z.string().min(1),
  fecha: esquemaFecha,
  ia: z.boolean(),
  tiktok: z.string().min(1),
  meta: z.string().min(1).optional(),
});

const esquemaCalendario = z.object({
  hora: z.string().regex(FORMA_HORA, "la hora debe ser HH:MM"),
  zona: z.literal("America/Bogota"),
  videos: z.array(esquemaVideo),
});

export interface VideoCalendario {
  id: string;
  carpeta: string;
  /** AAAA-MM-DD, en Bogotá. */
  fecha: string;
  ia: boolean;
  archivoTiktok: string;
  archivoMeta: string | null;
  /** Fecha y hora de publicación programada, en UTC. */
  programadoPara: Date;
}

export interface Calendario {
  hora: string;
  zona: string;
  videos: VideoCalendario[];
}

export function leerCalendario(json: unknown): Calendario {
  const datos = esquemaCalendario.parse(json);
  return {
    hora: datos.hora,
    zona: datos.zona,
    videos: datos.videos.map((video) => ({
      id: video.id,
      carpeta: video.carpeta,
      fecha: video.fecha,
      ia: video.ia,
      archivoTiktok: video.tiktok,
      archivoMeta: video.meta ?? null,
      programadoPara: new Date(`${video.fecha}T${datos.hora}:00-05:00`),
    })),
  };
}
