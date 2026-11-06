// Quién puede llamar al recolector por HTTP: quien traiga "Authorization: Bearer <RECOLECTOR_SECRETO>".
import { createHash, timingSafeEqual } from "node:crypto";

const hash = (t: string): Buffer => createHash("sha256").update(t, "utf8").digest();

/**
 * Compara en tiempo constante. Se comparan los hashes (siempre del mismo largo) para que timingSafeEqual
 * no lance con textos de largo distinto y para que el largo del secreto tampoco se filtre.
 * Sin secreto configurado, nadie entra.
 */
export function autorizado(cabecera: string | null, secreto: string | undefined): boolean {
  if (!secreto) return false;
  if (cabecera === null) return false;
  const m = /^Bearer (.+)$/i.exec(cabecera.trim());
  const dado = m?.[1];
  if (dado === undefined) return false;
  return timingSafeEqual(hash(dado), hash(secreto));
}
