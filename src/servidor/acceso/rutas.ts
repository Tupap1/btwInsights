// Ayudas comunes de las rutas /api/acceso/*. Los errores al cliente son genéricos: ningún detalle interno ni llave.
import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { datosWebauthn, type DatosWebauthn } from "../config";
import { COOKIE_DESAFIO, COOKIE_SESION, opcionesDesafio, opcionesSesion } from "./cookies";
import { origenPermitido } from "./origen";

export const noSePudo = (estado = 400) => Response.json({ error: "No se pudo." }, { status: estado });

/** Revisa Origin y carga la configuración. Devuelve la respuesta de error o la configuración. */
export function prepararPost(req: Request): Response | DatosWebauthn {
  let cfg: DatosWebauthn;
  try {
    cfg = datosWebauthn();
  } catch {
    // Falla cerrado; el mensaje (que nombra la variable) va al registro del servidor, no al cliente.
    console.error("Acceso sin configurar: faltan variables WEBAUTHN_*.");
    return noSePudo(503);
  }
  const ok = origenPermitido({
    produccion: process.env.NODE_ENV === "production",
    esperado: cfg.origen,
    recibido: req.headers.get("origin"),
  });
  return ok ? cfg : noSePudo(403);
}

export async function leerJson<T>(req: Request, esquema: z.ZodType<T>): Promise<T | null> {
  try {
    const r = esquema.safeParse(await req.json());
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Valida solo la forma general; la librería verifica el contenido de verdad. */
export function respuestaWebauthn<T extends object>(): z.ZodType<T> {
  return z.custom<T>(
    (v) =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as { id?: unknown }).id === "string" &&
      typeof (v as { rawId?: unknown }).rawId === "string" &&
      (v as { type?: unknown }).type === "public-key" &&
      typeof (v as { response?: unknown }).response === "object",
  );
}

export async function guardarDesafio(id: string): Promise<void> {
  (await cookies()).set(COOKIE_DESAFIO, id, opcionesDesafio());
}

export async function leerDesafio(): Promise<string | null> {
  return (await cookies()).get(COOKIE_DESAFIO)?.value ?? null;
}

export async function borrarDesafio(): Promise<void> {
  (await cookies()).set(COOKIE_DESAFIO, "", { ...opcionesDesafio(), maxAge: 0 });
}

export async function guardarSesion(token: string, expiraEn: Date): Promise<void> {
  (await cookies()).set(COOKIE_SESION, token, opcionesSesion(expiraEn));
}

export async function borrarSesion(): Promise<void> {
  (await cookies()).set(COOKIE_SESION, "", { ...opcionesSesion(new Date(0)), maxAge: 0 });
}
