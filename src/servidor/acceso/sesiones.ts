// Sesiones: token de 32 bytes en la cookie; en la base solo su sha256. Duran 30 días.
import "server-only";
import { and, eq, gt } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { sesion, usuario } from "../db/esquema";
import { hashDe, nuevoToken } from "./tokens";

export const VIGENCIA_SESION_MS = 30 * 24 * 3600_000;
const REFRESCO_USADA_MS = 60_000;

export async function crearSesion(
  db: BaseDeDatos,
  usuarioId: number,
  ahora: Date = new Date(),
): Promise<{ token: string; expiraEn: Date }> {
  const { token, hash } = nuevoToken();
  const expiraEn = new Date(ahora.getTime() + VIGENCIA_SESION_MS);
  await db.insert(sesion).values({ hash, usuarioId, creadaEn: ahora, expiraEn, usadaEn: ahora });
  return { token, expiraEn };
}

export async function validarSesion(
  db: BaseDeDatos,
  token: string,
  ahora: Date = new Date(),
): Promise<{ usuarioId: number; nombre: string } | null> {
  const hash = hashDe(token);
  const [f] = await db
    .select({ usuarioId: sesion.usuarioId, nombre: usuario.nombre, usadaEn: sesion.usadaEn })
    .from(sesion)
    .innerJoin(usuario, eq(usuario.id, sesion.usuarioId))
    .where(and(eq(sesion.hash, hash), gt(sesion.expiraEn, ahora), eq(usuario.activo, true)));
  if (!f) return null;
  // Como mucho una escritura por minuto, para no escribir en cada petición.
  if (!f.usadaEn || ahora.getTime() - f.usadaEn.getTime() >= REFRESCO_USADA_MS) {
    await db.update(sesion).set({ usadaEn: ahora }).where(eq(sesion.hash, hash));
  }
  return { usuarioId: f.usuarioId, nombre: f.nombre };
}

export async function cerrarSesion(db: BaseDeDatos, token: string): Promise<void> {
  await db.delete(sesion).where(eq(sesion.hash, hashDe(token)));
}
