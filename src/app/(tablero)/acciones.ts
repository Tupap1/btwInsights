"use server";
// Acciones del servidor. Cada una pide sesión primero y valida con zod.
// Solo escriben en la base: notas, formato y voz de un reel, y asignar una publicación a un reel.
// La única llamada a las APIs es "Actualizar ahora" (lecturas, solo GET). Nada se publica ni se programa desde aquí.
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { bd } from "@/servidor/db/cliente";
import { publicacion, reel } from "@/servidor/db/esquema";
import { FORMATOS, VOCES } from "@/servidor/consultas/videos";
import { clientes, secretos } from "@/servidor/recolector/clientes";
import { recolectar } from "@/servidor/recolector/recolectar";

export type EstadoAccion = { ok: boolean; mensaje: string } | null;

const SIN_DEFINIR = "sin_definir";

const esquemaReel = z.object({
  reelId: z.string().min(1).max(64),
  notas: z.string().max(20_000),
  formato: z.union([z.enum(FORMATOS), z.literal(SIN_DEFINIR)]),
  voz: z.union([z.enum(VOCES), z.literal(SIN_DEFINIR)]),
});

export async function guardarReel(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const r = esquemaReel.safeParse(Object.fromEntries(datos));
  if (!r.success) return { ok: false, mensaje: "Los datos no son válidos." };
  const { reelId, notas, formato, voz } = r.data;
  const filas = await bd()
    .update(reel)
    .set({
      notas: notas.trim() === "" ? null : notas,
      formato: formato === SIN_DEFINIR ? null : formato,
      voz: voz === SIN_DEFINIR ? null : voz,
      actualizadoEn: new Date(),
    })
    .where(eq(reel.id, reelId))
    .returning({ id: reel.id });
  if (filas.length === 0) return { ok: false, mensaje: "Ese reel no existe." };
  revalidatePath("/videos");
  revalidatePath(`/videos/${encodeURIComponent(reelId)}`);
  return { ok: true, mensaje: "Guardado." };
}

const esquemaAsignar = z.object({
  publicacionId: z.coerce.number().int().positive(),
  reelId: z.string().min(1).max(64),
});

export async function asignarPublicacion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const r = esquemaAsignar.safeParse(Object.fromEntries(datos));
  if (!r.success) return { ok: false, mensaje: "Escoge un reel." };
  const { publicacionId, reelId } = r.data;
  const [existe] = await bd().select({ id: reel.id }).from(reel).where(eq(reel.id, reelId));
  if (!existe) return { ok: false, mensaje: "Ese reel no existe." };
  // Solo toca una publicación que sigue sin reel: nunca pisa una asignación hecha por otro lado.
  const filas = await bd()
    .update(publicacion)
    .set({ reelId, emparejadoPor: "manual", actualizadoEn: new Date() })
    .where(and(eq(publicacion.id, publicacionId), isNull(publicacion.reelId)))
    .returning({ id: publicacion.id });
  if (filas.length === 0) return { ok: false, mensaje: "Esa publicación ya tiene reel." };
  revalidatePath("/sin-asignar");
  revalidatePath("/videos");
  revalidatePath("/hoy");
  return { ok: true, mensaje: `Asignada al ${reelId}.` };
}

/** El botón "Actualizar ahora": corre el recolector (solo lecturas) y devuelve el resumen. */
export async function actualizarAhora(): Promise<EstadoAccion> {
  await exigirSesion();
  try {
    const resumen = await recolectar(bd(), { ...clientes(), origen: "boton", secretos: secretos() });
    revalidatePath("/", "layout");
    if (resumen.estado === "ocupado") return { ok: false, mensaje: "Ya hay una lectura en curso. Espera un momento." };
    const partes = [
      `${resumen.lecturasNuevas} lecturas nuevas`,
      `${resumen.publicacionesNuevas} publicaciones nuevas`,
      `${resumen.pendientes} pendientes`,
    ];
    if (resumen.errores.length > 0) partes.push(`${resumen.errores.length} con error`);
    return {
      ok: resumen.estado !== "error",
      mensaje: `Lectura ${resumen.estado === "ok" ? "completa" : resumen.estado === "parcial" ? "parcial" : "con error"}: ${partes.join(", ")}.`,
    };
  } catch {
    // El detalle queda en la corrida y en las alertas; aquí no sale ningún mensaje de error crudo.
    return { ok: false, mensaje: "No se pudo actualizar. Revisa las alertas." };
  }
}
