import { cookies } from "next/headers";
import { COOKIE_SESION } from "@/servidor/acceso/cookies";
import { borrarSesion, noSePudo, prepararPost } from "@/servidor/acceso/rutas";
import { cerrarSesion } from "@/servidor/acceso/sesiones";
import { bd } from "@/servidor/db/cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const cfg = prepararPost(req);
  if (cfg instanceof Response) return cfg;
  try {
    const token = (await cookies()).get(COOKIE_SESION)?.value;
    if (token) await cerrarSesion(bd(), token);
    await borrarSesion();
    return Response.json({ ok: true });
  } catch {
    return noSePudo(500);
  }
}
