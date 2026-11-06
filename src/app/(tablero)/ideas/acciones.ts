"use server";
// Acción de /ideas: "Pasar a reel". Pide sesión, valida con zod y solo escribe en la base del tablero.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { bd } from "@/servidor/db/cliente";
import { reel } from "@/servidor/db/esquema";
import { esquemaIdNuevo, pasarAReel } from "@/servidor/ideas/pasar-a-reel";

export type EstadoPasar = { ok: boolean; mensaje: string } | null;

export async function pasarIdeaAReel(_previo: EstadoPasar, datos: FormData): Promise<EstadoPasar> {
  await exigirSesion();
  const ideaId = z.coerce.number().int().positive().safeParse(datos.get("ideaId"));
  if (!ideaId.success) return { ok: false, mensaje: "Los datos no son válidos." };
  const db = bd();
  const existentes = new Set((await db.select({ id: reel.id }).from(reel)).map((r) => r.id));
  const id = esquemaIdNuevo(existentes).safeParse(datos.get("reelId"));
  if (!id.success) return { ok: false, mensaje: id.error.issues[0]?.message ?? "El id no es válido." };
  const r = await pasarAReel(db, ideaId.data, id.data);
  if (!r.ok) return { ok: false, mensaje: r.mensaje };
  revalidatePath("/ideas");
  revalidatePath("/videos");
  return { ok: true, mensaje: r.yaEstaba ? `Ya estaba en el reel ${r.reelId}.` : `Creado el reel ${r.reelId}.` };
}
