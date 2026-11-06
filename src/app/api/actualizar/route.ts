// /api/actualizar (T25): al entrar al tablero se pide una lectura nueva a Zernio y Meta (solo GET).
//   POST: decide con decidirAlEntrar y, si toca, corre el recolector con after() (después de responder).
//   GET: si hay una lectura en curso y cómo terminó la última. Solo estados y fechas, nunca textos de error.
// Las dos exigen sesión; el POST además revisa Origin. Configuración de segmento (Next 16.4, sin cacheComponents).
import { desc, isNotNull } from "drizzle-orm";
import { after } from "next/server";
import { sesionActual } from "@/servidor/acceso/sesion";
import { noSePudo, prepararPost } from "@/servidor/acceso/rutas";
import { bd } from "@/servidor/db/cliente";
import { corrida } from "@/servidor/db/esquema";
import { decidirAlEntrar } from "@/servidor/recolector/al-entrar";
import { clientes, secretos } from "@/servidor/recolector/clientes";
import { recolectar } from "@/servidor/recolector/recolectar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sinSesion = () => Response.json({ error: "Se necesita iniciar sesión." }, { status: 401 });

export async function POST(request: Request): Promise<Response> {
  const preparado = prepararPost(request);
  if (preparado instanceof Response) return preparado;
  if (!(await sesionActual())) return sinSesion();
  try {
    const ahora = new Date();
    const [ultima] = await bd()
      .select({ estado: corrida.estado, iniciadaEn: corrida.iniciadaEn })
      .from(corrida)
      .orderBy(desc(corrida.iniciadaEn))
      .limit(1);
    const decision = decidirAlEntrar(ultima ?? null, ahora);
    if (decision === "iniciar") {
      after(async () => {
        try {
          await recolectar(bd(), { ...clientes(), origen: "boton", alEntrar: true, secretos: secretos() });
        } catch {
          // El detalle queda en la corrida y en las alertas; aquí no se registra ningún texto crudo.
          console.error("Actualizar al entrar: la lectura no terminó.");
        }
      });
      return Response.json({ estado: "iniciada", desde: ahora.toISOString() });
    }
    return Response.json({ estado: decision, desde: ahora.toISOString() });
  } catch {
    return noSePudo(500);
  }
}

export async function GET(): Promise<Response> {
  if (!(await sesionActual())) return sinSesion();
  try {
    const db = bd();
    const ahora = Date.now();
    const [actual] = await db
      .select({ estado: corrida.estado, iniciadaEn: corrida.iniciadaEn })
      .from(corrida)
      .orderBy(desc(corrida.iniciadaEn))
      .limit(1);
    const [ultima] = await db
      .select({ estado: corrida.estado, iniciadaEn: corrida.iniciadaEn, terminadaEn: corrida.terminadaEn })
      .from(corrida)
      .where(isNotNull(corrida.terminadaEn))
      .orderBy(desc(corrida.iniciadaEn))
      .limit(1);
    const enCurso =
      actual?.estado === "en_curso" && decidirAlEntrar(actual, new Date(ahora)) === "en_curso";
    return Response.json({
      enCurso,
      ultima: ultima
        ? {
            estado: ultima.estado,
            iniciadaEn: ultima.iniciadaEn.toISOString(),
            terminadaEn: ultima.terminadaEn?.toISOString() ?? null,
          }
        : null,
    });
  } catch {
    return noSePudo(500);
  }
}
