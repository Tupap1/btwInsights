// Tokens aleatorios. En la base solo se guarda su sha256: un volcado de la base no sirve para entrar.
import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 32 bytes aleatorios en base64url. */
export function aleatorio(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDe(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function nuevoToken(): { token: string; hash: string } {
  const token = aleatorio();
  return { token, hash: hashDe(token) };
}
