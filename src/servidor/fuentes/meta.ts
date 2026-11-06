// Cliente de solo lectura de Meta (Graph API). El token va en la cabecera, nunca en la URL.
import type { MetricasMeta } from "../tipos";
import { ErrorFuente, pedirJson, type OpcionesPedir } from "./http";

const MAX_PAGINAS = 200;

export interface OpcionesMeta {
  token: string;
  pageId: string;
  igUserId: string;
  version?: string;
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function datos(cuerpo: unknown): unknown[] {
  if (!esObjeto(cuerpo)) return [];
  const d = cuerpo["data"];
  return Array.isArray(d) ? (d as unknown[]) : [];
}

function siguienteCursor(cuerpo: unknown): string | null {
  if (!esObjeto(cuerpo)) return null;
  const paging = cuerpo["paging"];
  if (!esObjeto(paging) || !esObjeto(paging["cursors"])) return null;
  const after = paging["cursors"]["after"];
  // Meta solo trae paging.next si hay más; sin él no hay otra página aunque venga cursors.after.
  const hayMas = typeof paging["next"] === "string";
  return hayMas && typeof after === "string" && after.length > 0 ? after : null;
}

function valorDe(item: Record<string, unknown>): unknown {
  const valores = item["values"];
  if (Array.isArray(valores) && esObjeto(valores[0]) && valores[0]["value"] != null) return valores[0]["value"];
  const total = item["total_value"];
  if (esObjeto(total) && total["value"] != null) return total["value"];
  return null;
}

export function crearMeta(opciones: OpcionesMeta) {
  const base = `https://graph.facebook.com/${opciones.version ?? "v25.0"}`;

  const pedir = (ruta: string, params: Record<string, string>): Promise<unknown> => {
    const url = new URL(`${base}/${ruta}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const op: OpcionesPedir = {
      cabeceras: { Authorization: `Bearer ${opciones.token}` },
      secretos: [opciones.token],
    };
    if (opciones.fetch) op.fetch = opciones.fetch;
    if (opciones.esperar) op.esperar = opciones.esperar;
    return pedirJson(url, op);
  };

  /** Pagina armando la URL con paging.cursors.after; nunca sigue paging.next. */
  async function paginar(ruta: string, params: Record<string, string>): Promise<unknown[]> {
    const todos: unknown[] = [];
    let after: string | null = null;
    const vistos = new Set<string>();
    for (let i = 0; i < MAX_PAGINAS; i += 1) {
      const cuerpo = await pedir(ruta, after ? { ...params, after } : params);
      todos.push(...datos(cuerpo));
      after = siguienteCursor(cuerpo);
      if (!after || vistos.has(after)) break;
      vistos.add(after);
    }
    return todos;
  }

  function leerMetricas(cuerpo: unknown, nombres: readonly string[]): MetricasMeta {
    const porNombre = new Map<string, Record<string, unknown>>();
    for (const item of datos(cuerpo)) {
      if (esObjeto(item) && typeof item["name"] === "string") porNombre.set(item["name"], item);
    }
    const salida: MetricasMeta = {};
    for (const nombre of nombres) {
      const item = porNombre.get(nombre);
      salida[nombre] = item ? { ok: true, valor: valorDe(item) } : { ok: false, error: "no vino en la respuesta" };
    }
    return salida;
  }

  return {
    reelsFacebook(): Promise<unknown[]> {
      return paginar(`${opciones.pageId}/video_reels`, {
        fields: "id,description,created_time,permalink_url,length",
        limit: "50",
      });
    },
    mediaInstagram(): Promise<unknown[]> {
      return paginar(`${opciones.igUserId}/media`, {
        fields: "id,caption,media_product_type,timestamp,permalink",
        limit: "50",
      });
    },
    async metricas(objetoId: string, red: "facebook" | "instagram", nombres: readonly string[]): Promise<MetricasMeta> {
      const ruta = `${objetoId}/${red === "facebook" ? "video_insights" : "insights"}`;
      try {
        return leerMetricas(await pedir(ruta, { metric: nombres.join(",") }), nombres);
      } catch (e) {
        if (!(e instanceof ErrorFuente) || e.codigo !== 100) throw e;
      }
      // Meta rechazó alguna métrica: una por una, para que solo falle la inválida.
      const salida: MetricasMeta = {};
      for (const nombre of nombres) {
        try {
          Object.assign(salida, leerMetricas(await pedir(ruta, { metric: nombre }), [nombre]));
        } catch (e) {
          if (!(e instanceof ErrorFuente)) throw e;
          salida[nombre] = { ok: false, error: e.message };
        }
      }
      return salida;
    },
    cuentaFacebook(): Promise<unknown> {
      return pedir(opciones.pageId, { fields: "followers_count,fan_count" });
    },
    cuentaInstagram(): Promise<unknown> {
      return pedir(opciones.igUserId, { fields: "followers_count,media_count" });
    },
  };
}

export type ClienteMeta = ReturnType<typeof crearMeta>;
