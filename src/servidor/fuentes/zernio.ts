// Cliente de solo lectura de Zernio. No hay ningún método que acepte otro verbo HTTP.
import { pedirJson, type OpcionesPedir } from "./http";

const BASE = "https://zernio.com/api/v1";
const MAX_PAGINAS = 200;

export type EstadoZernio =
  | "draft"
  | "pending_approval"
  | "scheduled"
  | "publishing"
  | "published"
  | "partial"
  | "failed"
  | "cancelled";

export interface OpcionesZernio {
  apiKey: string;
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  ahora?: () => number;
  porMinuto?: number;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

interface Paginacion {
  page: number | null;
  pages: number | null;
  nextCursor: string | null;
}

function leerPaginacion(cuerpo: unknown): Paginacion {
  const p = esObjeto(cuerpo) ? cuerpo["pagination"] : undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  if (!esObjeto(p)) return { page: null, pages: null, nextCursor: null };
  const c = p["nextCursor"];
  return { page: num(p["page"]), pages: num(p["pages"]), nextCursor: typeof c === "string" && c.length > 0 ? c : null };
}

function elementos(cuerpo: unknown, clave: string): unknown[] {
  if (!esObjeto(cuerpo)) return [];
  const v = cuerpo[clave];
  return Array.isArray(v) ? (v as unknown[]) : [];
}

export function crearZernio(opciones: OpcionesZernio) {
  const { apiKey } = opciones;
  const porMinuto = opciones.porMinuto ?? 50;
  const ahora = opciones.ahora ?? Date.now;
  const esperar = opciones.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const fetchBase = opciones.fetch ?? fetch;
  const marcas: number[] = [];

  // Cada intento de red (también los reintentos) cuenta contra la ventana de 60 s.
  const fetchLimitado: typeof fetch = async (entrada, init) => {
    for (;;) {
      const t = ahora();
      while (marcas.length > 0 && (marcas[0] as number) <= t - 60_000) marcas.shift();
      if (marcas.length < porMinuto) break;
      await esperar(Math.max(1, (marcas[0] as number) + 60_000 - t));
    }
    marcas.push(ahora());
    return fetchBase(entrada, init);
  };

  const pedir = (ruta: string, params: Record<string, string> = {}): Promise<unknown> => {
    const url = new URL(`${BASE}${ruta}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const op: OpcionesPedir = {
      cabeceras: { Authorization: `Bearer ${apiKey}` },
      secretos: [apiKey],
      fetch: fetchLimitado,
    };
    if (opciones.esperar) op.esperar = opciones.esperar;
    return pedirJson(url, op);
  };

  /** Pagina con nextCursor cuando la respuesta lo trae; si no, con page/pages. */
  async function paginar(ruta: string, clave: string, params: Record<string, string>): Promise<unknown[]> {
    const todos: unknown[] = [];
    let pagina = 1;
    let cursor: string | null = null;
    for (let i = 0; i < MAX_PAGINAS; i += 1) {
      const p: Record<string, string> = { ...params, page: String(pagina) };
      if (cursor) p["cursor"] = cursor;
      const cuerpo = await pedir(ruta, p);
      todos.push(...elementos(cuerpo, clave));
      const pag = leerPaginacion(cuerpo);
      if (pag.nextCursor) {
        cursor = pag.nextCursor;
        pagina = (pag.page ?? pagina) + 1;
      } else if (pag.pages !== null && (pag.page ?? pagina) < pag.pages) {
        cursor = null;
        pagina = (pag.page ?? pagina) + 1;
      } else {
        break;
      }
    }
    return todos;
  }

  return {
    async cuentas(): Promise<unknown[]> {
      return elementos(await pedir("/accounts"), "accounts");
    },
    /** Todas las páginas de /analytics (limit 100). */
    analitica(): Promise<unknown[]> {
      return paginar("/analytics", "posts", { limit: "100" });
    },
    posts(estado: EstadoZernio): Promise<unknown[]> {
      return paginar("/posts", "posts", { status: estado, limit: "50" });
    },
    async post(id: string): Promise<unknown> {
      const cuerpo = await pedir(`/posts/${encodeURIComponent(id)}`);
      return esObjeto(cuerpo) && "post" in cuerpo ? cuerpo["post"] : cuerpo;
    },
    historial(postId: string): Promise<unknown> {
      return pedir("/analytics/post-timeline", { postId });
    },
    seguidores(): Promise<unknown> {
      return pedir("/accounts/follower-stats");
    },
  };
}

export type ClienteZernio = ReturnType<typeof crearZernio>;
