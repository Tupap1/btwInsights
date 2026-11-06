// "Pasar a reel": crea el reel (estado "idea", con el gancho y el formato de la idea) y une la idea a él.
// Todo en una transacción con la idea bloqueada: dos pulsaciones a la vez no crean dos reels. Solo toca la base del tablero.
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { BaseDeDatos } from "../db/cliente";
import { idea, reel } from "../db/esquema";

/** Id de reel nuevo: texto corto como "23", "09c" o "TERROR03". */
export const esquemaIdReel = z
  .string()
  .trim()
  .min(1, "Escribe el id del reel.")
  .max(32, "El id es demasiado largo.")
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "El id solo lleva letras, números, guion y guion bajo.");

/** Valida el id contra los que ya existen (para avisar antes de intentar). */
export const esquemaIdNuevo = (existentes: ReadonlySet<string>) =>
  esquemaIdReel.refine((id) => !existentes.has(id), "Ya existe un reel con ese id.");

export type ResultadoPasar =
  | { ok: true; reelId: string; yaEstaba: boolean }
  | { ok: false; mensaje: string };

export async function pasarAReel(db: BaseDeDatos, ideaId: number, reelIdCrudo: string): Promise<ResultadoPasar> {
  const id = esquemaIdReel.safeParse(reelIdCrudo);
  if (!id.success) return { ok: false, mensaje: id.error.issues[0]?.message ?? "El id no es válido." };
  const reelId = id.data;
  return db.transaction(async (tx): Promise<ResultadoPasar> => {
    const [fila] = await tx.select().from(idea).where(eq(idea.id, ideaId)).for("update");
    if (!fila) return { ok: false, mensaje: "Esa idea no existe." };
    if (fila.reelId !== null) {
      // Segunda pulsación con el mismo id: ya está hecho, sin crear nada.
      return fila.reelId === reelId
        ? { ok: true, reelId, yaEstaba: true }
        : { ok: false, mensaje: `Esta idea ya pasó al reel ${fila.reelId}.` };
    }
    const [existe] = await tx.select({ id: reel.id }).from(reel).where(eq(reel.id, reelId));
    if (existe) return { ok: false, mensaje: `Ya existe el reel ${reelId}.` };
    await tx.insert(reel).values({
      id: reelId,
      gancho: fila.gancho,
      formato: fila.formato,
      estado: "idea",
      notas: `Sale de la idea "${fila.titulo}"${fila.fuente ? ` (${fila.fuente})` : ""}.`,
    });
    await tx.update(idea).set({ reelId, estado: "en_reel" }).where(eq(idea.id, ideaId));
    return { ok: true, reelId, yaEstaba: false };
  });
}
