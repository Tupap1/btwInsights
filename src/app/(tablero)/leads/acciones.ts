"use server";
// Registrar un lead a mano. Pide sesión, valida con zod (en guardarLead) y solo escribe en la tabla `lead`.
import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { bd } from "@/servidor/db/cliente";
import { ahoraServidor } from "@/servidor/consultas/tiempo";
import { guardarLead } from "@/servidor/leads/guardar";

export type EstadoLead = { ok: boolean; mensaje: string } | null;

export async function registrarLead(_previo: EstadoLead, datos: FormData): Promise<EstadoLead> {
  await exigirSesion();
  const r = await guardarLead(bd(), Object.fromEntries(datos), ahoraServidor());
  if (!r.ok) return { ok: false, mensaje: r.mensaje };
  revalidatePath("/leads");
  revalidatePath("/hoy");
  return { ok: true, mensaje: "Lead registrado." };
}
