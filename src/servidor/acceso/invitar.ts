// Arma el enlace de invitación (lo usa scripts/invitar.ts).
import "server-only";
import { datosWebauthn } from "../config";
import { bd } from "../db/cliente";
import { crearInvitacion } from "./invitaciones";

export async function crearEnlaceDeInvitacion(nombre: string): Promise<{ enlace: string; expiraEn: Date }> {
  const { origen } = datosWebauthn();
  const { token, expiraEn } = await crearInvitacion(bd(), nombre);
  return { enlace: `${origen.replace(/\/$/, "")}/registrar?t=${token}`, expiraEn };
}
