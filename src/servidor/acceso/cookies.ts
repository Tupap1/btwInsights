// Nombres y opciones de las cookies de acceso.
import "server-only";

export const COOKIE_SESION = "__Host-btw_sesion";
export const COOKIE_DESAFIO = "btw_desafio";

const produccion = () => process.env.NODE_ENV === "production";

export function opcionesSesion(expiraEn: Date) {
  return { httpOnly: true, secure: produccion(), sameSite: "lax" as const, path: "/", expires: expiraEn };
}

export function opcionesDesafio() {
  return { httpOnly: true, secure: produccion(), sameSite: "strict" as const, path: "/api/acceso", maxAge: 300 };
}
