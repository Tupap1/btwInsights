// POST /api/recolectar: corre el recolector. Solo con "Authorization: Bearer <RECOLECTOR_SECRETO>".
// Configuración de segmento (Next 16.4, sin cacheComponents): Node.js, nunca estático y hasta 60 s.
import { config } from "@/servidor/config";
import { bd } from "@/servidor/db/cliente";
import { autorizado } from "@/servidor/recolector/autorizar";
import { clientes, secretos } from "@/servidor/recolector/clientes";
import { recolectar } from "@/servidor/recolector/recolectar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    if (!autorizado(request.headers.get("authorization"), config().RECOLECTOR_SECRETO)) {
      return Response.json({ error: "no autorizado" }, { status: 401 });
    }
    // El presupuesto (50 s) deja margen bajo el tope de 60 s de la ruta.
    const resumen = await recolectar(bd(), { ...clientes(), origen: "http", secretos: secretos() });
    // Solo conteos y estados: los textos de los errores quedan en la corrida y en las alertas.
    if (resumen.estado === "ocupado") return Response.json(resumen);
    return Response.json({ ...resumen, errores: resumen.errores.length });
  } catch {
    return Response.json({ error: "no se pudo recolectar" }, { status: 500 });
  }
}
