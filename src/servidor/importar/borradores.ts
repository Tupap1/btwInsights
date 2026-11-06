// Lee zernio-borradores.csv (un borrador por video y red, creado en Zernio). Función pura: recibe el texto ya leído.
// En TikTok e Instagram, post_id es el id de Zernio. En Facebook es el id del video en Meta.

import { parse } from "csv-parse/sync";
import { z } from "zod";
import type { Red } from "../tipos";

export interface BorradorRegistrado {
  reelId: string;
  red: Red;
  /** AAAA-MM-DD, el día que se planeó publicar. */
  fechaPlan: string;
  /** Id del post en Zernio (TikTok e Instagram). */
  zernioPostId: string | null;
  /** Id del video en Meta (Facebook). */
  postIdPlataforma: string | null;
  estado: string;
  creadoEn: Date;
}

const esquemaFila = z.object({
  id: z.string().trim().min(1, "falta el id del reel"),
  red: z.enum(["tiktok", "instagram", "facebook"]),
  fecha_plan: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha_plan debe ser AAAA-MM-DD"),
  post_id: z.string(),
  estado: z.string().trim().min(1, "falta el estado"),
  creado: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "creado no es una fecha válida")
    .transform((s) => new Date(s)),
});

export function leerBorradoresCsv(contenido: string): BorradorRegistrado[] {
  const filas: unknown = parse(contenido, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  });

  return z.array(z.unknown()).parse(filas).map((fila, indice) => {
    // La cabecera es la fila 1 del archivo: la primera fila de datos es la 2.
    const numeroFila = indice + 2;
    const resultado = esquemaFila.safeParse(fila);
    if (!resultado.success) {
      const detalle = resultado.error.issues
        .map((issue) => `${issue.path.join(".") || "fila"}: ${issue.message}`)
        .join("; ");
      throw new Error(`zernio-borradores.csv, fila ${numeroFila}: ${detalle}`);
    }

    const datos = resultado.data;
    const postId = datos.post_id.trim() === "" ? null : datos.post_id.trim();
    const esFacebook = datos.red === "facebook";

    return {
      reelId: datos.id.trim(),
      red: datos.red,
      fechaPlan: datos.fecha_plan,
      zernioPostId: esFacebook ? null : postId,
      postIdPlataforma: esFacebook ? postId : null,
      estado: datos.estado.trim(),
      creadoEn: datos.creado,
    };
  });
}
