// Sesión de quien usa el tablero. Cada página, acción del servidor y ruta privada llama a exigirSesion().
// En desarrollo y pruebas entra el usuario "local". En producción solo entra quien tiene la cookie
// __Host-btw_sesion con una sesión vigente en la base y un usuario activo.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { bd } from "../db/cliente";
import { COOKIE_SESION } from "./cookies";
import { validarSesion } from "./sesiones";

export interface Sesion {
  usuario: string;
}

export class SinSesion extends Error {
  constructor() {
    super("Se necesita iniciar sesión.");
    this.name = "SinSesion";
  }
}

export async function sesionActual(): Promise<Sesion | null> {
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") return { usuario: "local" };
  if (process.env.NODE_ENV !== "production") return null;
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token) return null;
  try {
    const s = await validarSesion(bd(), token);
    return s ? { usuario: s.nombre } : null;
  } catch {
    // Si la base falla, nadie entra.
    return null;
  }
}

/** Devuelve la sesión o manda a /entrar. */
export async function exigirSesion(): Promise<Sesion> {
  const s = await sesionActual();
  if (!s) redirect("/entrar");
  return s;
}
