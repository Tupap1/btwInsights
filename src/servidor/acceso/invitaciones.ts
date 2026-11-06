// Invitaciones de un solo uso (24 h). El token va en el enlace; en la base solo su sha256.
import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { invitacion, usuario } from "../db/esquema";
import { aleatorio, hashDe, nuevoToken } from "./tokens";

export const VIGENCIA_INVITACION_MS = 24 * 3600_000;

export async function crearInvitacion(
  db: BaseDeDatos,
  nombre: string,
  ahora: Date = new Date(),
): Promise<{ token: string; expiraEn: Date; usuarioId: number }> {
  const limpio = nombre.trim();
  if (!limpio) throw new Error("Falta el nombre.");
  return db.transaction(async (tx) => {
    await tx.insert(usuario).values({ nombre: limpio, idWebauthn: aleatorio() }).onConflictDoNothing({ target: usuario.nombre });
    const [u] = await tx.select().from(usuario).where(eq(usuario.nombre, limpio));
    if (!u) throw new Error("No se pudo crear el usuario.");
    if (!u.activo) throw new Error("El usuario está inactivo.");
    const { token, hash } = nuevoToken();
    const expiraEn = new Date(ahora.getTime() + VIGENCIA_INVITACION_MS);
    await tx.insert(invitacion).values({ hash, usuarioId: u.id, creadaEn: ahora, expiraEn });
    return { token, expiraEn, usuarioId: u.id };
  });
}

/** Mira si la invitación sirve, sin gastarla. */
export async function validarInvitacion(
  db: BaseDeDatos,
  token: string,
  ahora: Date = new Date(),
): Promise<{ usuarioId: number; nombre: string } | null> {
  const [f] = await db
    .select({ usuarioId: invitacion.usuarioId, nombre: usuario.nombre })
    .from(invitacion)
    .innerJoin(usuario, eq(usuario.id, invitacion.usuarioId))
    .where(and(eq(invitacion.hash, hashDe(token)), isNull(invitacion.usadaEn), gt(invitacion.expiraEn, ahora), eq(usuario.activo, true)));
  return f ?? null;
}

/** La gasta (la marca usada, no la borra). Devuelve el usuario, o null si ya se usó, venció o no existe. */
export async function consumirInvitacion(db: BaseDeDatos, token: string, ahora: Date = new Date()): Promise<number | null> {
  const [f] = await db
    .update(invitacion)
    .set({ usadaEn: ahora })
    .where(and(eq(invitacion.hash, hashDe(token)), isNull(invitacion.usadaEn), gt(invitacion.expiraEn, ahora)))
    .returning({ usuarioId: invitacion.usuarioId });
  return f?.usuarioId ?? null;
}
