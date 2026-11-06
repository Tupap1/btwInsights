import { guardarDesafio, noSePudo, prepararPost } from "@/servidor/acceso/rutas";
import { iniciarEntrada } from "@/servidor/acceso/webauthn";
import { bd } from "@/servidor/db/cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const cfg = prepararPost(req);
  if (cfg instanceof Response) return cfg;
  try {
    const ini = await iniciarEntrada(bd(), cfg);
    await guardarDesafio(ini.desafioId);
    return Response.json(ini.opciones);
  } catch {
    return noSePudo(500);
  }
}
