// WebAuthn (llaves de acceso) con @simplewebauthn/server. Las funciones verify* se inyectan para probar sin
// autenticadores reales; por defecto se usa la librería.
import "server-only";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { credencial, usuario } from "../db/esquema";
import { consumirDesafio, crearDesafio } from "./desafios";
import { consumirInvitacion, validarInvitacion } from "./invitaciones";
import { crearSesion } from "./sesiones";

export interface ConfigWebauthn {
  rpId: string;
  origen: string;
  rpNombre: string;
}
export type RespuestaRegistro = RegistrationResponseJSON;
export type RespuestaEntrada = AuthenticationResponseJSON;

export type VerificarRegistro = (o: {
  respuesta: RespuestaRegistro;
  reto: string;
  origen: string;
  rpId: string;
}) => Promise<{
  verified: boolean;
  credential?: { id: string; publicKey: Uint8Array<ArrayBuffer>; counter: number; transports?: string[] };
}>;

export type VerificarEntrada = (o: {
  respuesta: RespuestaEntrada;
  reto: string;
  origen: string;
  rpId: string;
  credencial: { id: string; publicKey: Uint8Array<ArrayBuffer>; counter: number; transports?: string[] };
}) => Promise<{ verified: boolean; newCounter: number }>;

export const verificarRegistroReal: VerificarRegistro = async (o) => {
  const r = await verifyRegistrationResponse({
    response: o.respuesta,
    expectedChallenge: o.reto,
    expectedOrigin: o.origen,
    expectedRPID: o.rpId,
    requireUserVerification: true,
  });
  return r.verified ? { verified: true, credential: r.registrationInfo.credential } : { verified: false };
};

export const verificarEntradaReal: VerificarEntrada = async (o) => {
  const r = await verifyAuthenticationResponse({
    response: o.respuesta,
    expectedChallenge: o.reto,
    expectedOrigin: o.origen,
    expectedRPID: o.rpId,
    credential: o.credencial,
    requireUserVerification: true,
  });
  return { verified: r.verified, newCounter: r.authenticationInfo.newCounter };
};

const aBase64Url = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const deBase64Url = (s: string) => new Uint8Array(Buffer.from(s, "base64url")) as Uint8Array<ArrayBuffer>;

export interface Inicio<O> {
  opciones: O;
  desafioId: string;
}

/** Empieza el registro de una llave con una invitación válida. null si la invitación no sirve. */
export async function iniciarRegistro(
  db: BaseDeDatos,
  cfg: ConfigWebauthn,
  token: string,
  ahora: Date = new Date(),
): Promise<Inicio<PublicKeyCredentialCreationOptionsJSON> | null> {
  const inv = await validarInvitacion(db, token, ahora);
  if (!inv) return null;
  const [u] = await db.select().from(usuario).where(eq(usuario.id, inv.usuarioId));
  if (!u) return null;
  const existentes = await db.select({ id: credencial.id, transportes: credencial.transportes }).from(credencial).where(eq(credencial.usuarioId, u.id));
  const opciones = await generateRegistrationOptions({
    rpName: cfg.rpNombre,
    rpID: cfg.rpId,
    userName: u.nombre,
    userID: new TextEncoder().encode(u.idWebauthn),
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    excludeCredentials: existentes.map((c) => ({ id: c.id, transports: c.transportes ?? undefined })),
  });
  const desafioId = await crearDesafio(db, { reto: opciones.challenge, tipo: "registro", usuarioId: u.id }, ahora);
  return { opciones, desafioId };
}

/** Termina el registro: guarda la credencial, gasta la invitación y abre la sesión. null = no entra. */
export async function terminarRegistro(
  db: BaseDeDatos,
  cfg: ConfigWebauthn,
  datos: { token: string; desafioId: string; respuesta: RespuestaRegistro },
  verificar: VerificarRegistro = verificarRegistroReal,
  ahora: Date = new Date(),
): Promise<{ token: string; expiraEn: Date } | null> {
  const d = await consumirDesafio(db, datos.desafioId, "registro", ahora);
  if (!d?.usuarioId) return null;
  const inv = await validarInvitacion(db, datos.token, ahora);
  if (!inv || inv.usuarioId !== d.usuarioId) return null;
  let v: Awaited<ReturnType<VerificarRegistro>>;
  try {
    v = await verificar({ respuesta: datos.respuesta, reto: d.reto, origen: cfg.origen, rpId: cfg.rpId });
  } catch {
    return null;
  }
  if (!v.verified || !v.credential) return null;
  const cred = v.credential;
  try {
    return await db.transaction(async (tx) => {
      // Gastar la invitación en la misma transacción: si otra petición ya la gastó, no se guarda nada.
      if ((await consumirInvitacion(tx as unknown as BaseDeDatos, datos.token, ahora)) === null) throw new Error("invitación gastada");
      await tx.insert(credencial).values({
        id: cred.id,
        usuarioId: inv.usuarioId,
        clavePublica: aBase64Url(cred.publicKey),
        contador: cred.counter,
        transportes: cred.transports ?? [],
        creadaEn: ahora,
        usadaEn: ahora,
      });
      return crearSesion(tx as unknown as BaseDeDatos, inv.usuarioId, ahora);
    });
  } catch {
    return null;
  }
}

/** Empieza la entrada con credenciales detectables (sin allowCredentials). */
export async function iniciarEntrada(
  db: BaseDeDatos,
  cfg: ConfigWebauthn,
  ahora: Date = new Date(),
): Promise<Inicio<PublicKeyCredentialRequestOptionsJSON>> {
  const opciones = await generateAuthenticationOptions({ rpID: cfg.rpId, userVerification: "required" });
  const desafioId = await crearDesafio(db, { reto: opciones.challenge, tipo: "entrada" }, ahora);
  return { opciones, desafioId };
}

/** Termina la entrada: firma, contador y usuario activo. null = no entra. */
export async function terminarEntrada(
  db: BaseDeDatos,
  cfg: ConfigWebauthn,
  datos: { desafioId: string; respuesta: RespuestaEntrada },
  verificar: VerificarEntrada = verificarEntradaReal,
  ahora: Date = new Date(),
): Promise<{ token: string; expiraEn: Date } | null> {
  const d = await consumirDesafio(db, datos.desafioId, "entrada", ahora);
  if (!d) return null;
  const [c] = await db
    .select({
      id: credencial.id,
      usuarioId: credencial.usuarioId,
      clavePublica: credencial.clavePublica,
      contador: credencial.contador,
      transportes: credencial.transportes,
    })
    .from(credencial)
    .innerJoin(usuario, eq(usuario.id, credencial.usuarioId))
    .where(and(eq(credencial.id, datos.respuesta.id), eq(usuario.activo, true)));
  if (!c) return null;
  let v: Awaited<ReturnType<VerificarEntrada>>;
  try {
    v = await verificar({
      respuesta: datos.respuesta,
      reto: d.reto,
      origen: cfg.origen,
      rpId: cfg.rpId,
      credencial: { id: c.id, publicKey: deBase64Url(c.clavePublica), counter: c.contador, transports: c.transportes ?? undefined },
    });
  } catch {
    return null;
  }
  if (!v.verified) return null;
  // Un contador que no sube delata una llave clonada (salvo las que siempre dan 0).
  if ((v.newCounter > 0 || c.contador > 0) && v.newCounter <= c.contador) return null;
  const actualizadas = await db
    .update(credencial)
    .set({ contador: v.newCounter, usadaEn: ahora })
    .where(and(eq(credencial.id, c.id), eq(credencial.contador, c.contador)))
    .returning({ id: credencial.id });
  if (actualizadas.length === 0) return null;
  return crearSesion(db, c.usuarioId, ahora);
}
