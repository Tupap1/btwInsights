"use server";
// Editar un borrador de Zernio desde /cola (T15). Dos pasos: "revisar" (no escribe nada) y "guardar" (con
// confirmación explícita). Pide sesión primero, valida con zod y nunca devuelve un error crudo ni una llave.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSesion } from "@/servidor/acceso/sesion";
import {
  ErrorEdicion,
  fechaBogotaADate,
  guardarEdicion,
  revisarEdicion,
  type EntradaEdicion,
  type ResumenEdicion,
} from "@/servidor/borradores/editar";
import { bd } from "@/servidor/db/cliente";
import { ahoraServidor } from "@/servidor/consultas/tiempo";
import { config } from "@/servidor/config";
import { crearZernio } from "@/servidor/fuentes/zernio";

export type EstadoEdicion =
  | null
  | { paso: "error"; mensaje: string }
  | { paso: "revisado"; resumen: ResumenEdicion }
  | { paso: "guardado"; mensaje: string };

const esquema = z.object({
  paso: z.enum(["revisar", "guardar"]),
  confirmar: z.string().optional(),
  publicacionId: z.coerce.number().int().positive(),
  texto: z.string().max(5_000),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
});

const NO_VALIDO: EstadoEdicion = { paso: "error", mensaje: "Revisa el texto, la fecha y la hora." };

export async function editarBorrador(_previo: EstadoEdicion, datos: FormData): Promise<EstadoEdicion> {
  await exigirSesion();
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return NO_VALIDO;
  const { paso, confirmar, publicacionId, texto, dia, hora } = r.data;
  const fecha = fechaBogotaADate(dia, hora);
  if (!fecha) return NO_VALIDO;
  const entrada: EntradaEdicion = { publicacionId, texto, programadoPara: fecha };
  const ahora = ahoraServidor();

  try {
    if (paso === "revisar") return { paso: "revisado", resumen: await revisarEdicion(bd(), entrada, ahora) };

    if (confirmar !== "si") return { paso: "error", mensaje: "Falta confirmar el cambio." };
    const llave = config().ZERNIO_API_KEY;
    if (!llave) return { paso: "error", mensaje: "Zernio no está configurado." };
    await guardarEdicion(bd(), entrada, crearZernio({ apiKey: llave }), ahora);
    revalidatePath("/cola");
    return { paso: "guardado", mensaje: "Borrador guardado en Zernio y en el tablero." };
  } catch (e) {
    // Solo los ErrorEdicion traen un mensaje pensado para el usuario; cualquier otro error sale genérico.
    if (e instanceof ErrorEdicion) return { paso: "error", mensaje: e.message };
    return { paso: "error", mensaje: "No se pudo completar. Inténtalo de nuevo." };
  }
}
