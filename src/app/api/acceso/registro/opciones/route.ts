import { z } from "zod";
import { iniciarRegistro } from "@/servidor/acceso/webauthn";
import { guardarDesafio, leerJson, noSePudo, prepararPost } from "@/servidor/acceso/rutas";
import { bd } from "@/servidor/db/cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const cfg = prepararPost(req);
  if (cfg instanceof Response) return cfg;
  const cuerpo = await leerJson(req, z.object({ t: z.string().min(1).max(200) }));
  if (!cuerpo) return noSePudo();
  try {
    const ini = await iniciarRegistro(bd(), cfg, cuerpo.t);
    if (!ini) return noSePudo(400);
    await guardarDesafio(ini.desafioId);
    return Response.json(ini.opciones);
  } catch {
    return noSePudo(500);
  }
}
