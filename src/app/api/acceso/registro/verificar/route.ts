import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { borrarDesafio, guardarSesion, leerDesafio, leerJson, noSePudo, prepararPost, respuestaWebauthn } from "@/servidor/acceso/rutas";
import { terminarRegistro } from "@/servidor/acceso/webauthn";
import { bd } from "@/servidor/db/cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const cfg = prepararPost(req);
  if (cfg instanceof Response) return cfg;
  const cuerpo = await leerJson(
    req,
    z.object({ t: z.string().min(1).max(200), respuesta: respuestaWebauthn<RegistrationResponseJSON>() }),
  );
  const desafioId = await leerDesafio();
  if (!cuerpo || !desafioId) return noSePudo();
  try {
    const s = await terminarRegistro(bd(), cfg, { token: cuerpo.t, desafioId, respuesta: cuerpo.respuesta });
    await borrarDesafio();
    if (!s) return noSePudo(401);
    await guardarSesion(s.token, s.expiraEn);
    return Response.json({ ok: true });
  } catch {
    return noSePudo(500);
  }
}
