// GET /api/exportar/metricas.csv: las métricas en CSV para btw-videos. Solo con
// "Authorization: Bearer <RECOLECTOR_SECRETO>" (misma comparación en tiempo constante que /api/recolectar).
// Va fuera del proxy de sesión: tiene su propio secreto. Solo lee; nunca escribe.
import { config } from "@/servidor/config";
import { bd } from "@/servidor/db/cliente";
import { csvDeMetricas } from "@/servidor/exportar/metricas";
import { autorizado } from "@/servidor/recolector/autorizar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    if (!autorizado(request.headers.get("authorization"), config().RECOLECTOR_SECRETO)) {
      return new Response("no autorizado", { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const csv = await csvDeMetricas(bd());
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="metricas.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("no se pudo exportar", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
