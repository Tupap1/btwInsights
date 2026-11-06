// Desafíos de WebAuthn: una fila que se gasta una sola vez y vence a los 5 minutos.
import "server-only";
import { and, eq, gt, lte } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { desafio } from "../db/esquema";
import { aleatorio } from "./tokens";

export const VIGENCIA_DESAFIO_MS = 5 * 60_000;

export async function crearDesafio(
  db: BaseDeDatos,
  datos: { reto: string; tipo: "registro" | "entrada"; usuarioId?: number },
  ahora: Date = new Date(),
): Promise<string> {
  // Limpieza de paso: los vencidos ya no sirven.
  await db.delete(desafio).where(lte(desafio.expiraEn, ahora));
  const id = aleatorio();
  await db.insert(desafio).values({
    id,
    reto: datos.reto,
    tipo: datos.tipo,
    usuarioId: datos.usuarioId ?? null,
    expiraEn: new Date(ahora.getTime() + VIGENCIA_DESAFIO_MS),
  });
  return id;
}

/** Lo borra al leerlo: sirve una sola vez. */
export async function consumirDesafio(
  db: BaseDeDatos,
  id: string,
  tipo: "registro" | "entrada",
  ahora: Date = new Date(),
): Promise<{ reto: string; usuarioId: number | null } | null> {
  const [f] = await db
    .delete(desafio)
    .where(and(eq(desafio.id, id), eq(desafio.tipo, tipo), gt(desafio.expiraEn, ahora)))
    .returning({ reto: desafio.reto, usuarioId: desafio.usuarioId });
  return f ?? null;
}
