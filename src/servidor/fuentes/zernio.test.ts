import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { crearZernio } from "./zernio";

const fixture = (nombre: string): Record<string, unknown> =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../pruebas/fixtures/api/${nombre}.json`, import.meta.url)), "utf8")) as Record<string, unknown>;

const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });

type Llamada = { url: URL; init: RequestInit | undefined };

/** fetch falso: guarda cada llamada y responde con lo que decida `responder`. */
function falso(responder: (url: URL, n: number) => unknown) {
  const llamadas: Llamada[] = [];
  const f = (async (entrada: URL | string | Request, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : entrada.toString());
    llamadas.push({ url, init });
    return json(responder(url, llamadas.length));
  }) as typeof fetch;
  return { f, llamadas };
}

const KEY = "zk_clave_secreta_de_prueba";
const sinEspera = async () => {};

describe("zernio", () => {
  it("analitica usa limit 100 y recorre pagination.pages", async () => {
    const base = fixture("zernio-analytics");
    const posts = base["posts"] as unknown[];
    const { f, llamadas } = falso((url) => {
      const page = Number(url.searchParams.get("page"));
      return { ...base, posts: page === 1 ? posts : [{ _id: "extra" }], pagination: { page, limit: 100, total: 18, pages: 2 } };
    });
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    const r = await z.analitica();
    expect(r).toHaveLength(posts.length + 1);
    expect(llamadas.map((l) => l.url.searchParams.get("page"))).toEqual(["1", "2"]);
    expect(llamadas[0]?.url.searchParams.get("limit")).toBe("100");
    const u0 = llamadas[0]?.url;
    expect(`${u0?.origin}${u0?.pathname}`).toBe("https://zernio.com/api/v1/analytics");
  });

  it("posts: con el fixture real (una sola página, nextCursor null) hace una llamada", async () => {
    const { f, llamadas } = falso(() => fixture("zernio-posts-draft"));
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    const r = await z.posts("draft");
    expect(r).toHaveLength(18);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url.searchParams.get("status")).toBe("draft");
  });

  it("posts: sigue nextCursor mientras venga", async () => {
    const { f, llamadas } = falso((url) => {
      const cursor = url.searchParams.get("cursor");
      if (!cursor) return { posts: [{ _id: "a" }], pagination: { page: 1, pages: 1, nextCursor: "c2" } };
      if (cursor === "c2") return { posts: [{ _id: "b" }], pagination: { page: 2, pages: 1, nextCursor: "c3" } };
      return { posts: [{ _id: "c" }], pagination: { page: 3, pages: 1, nextCursor: null } };
    });
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    expect(await z.posts("published")).toEqual([{ _id: "a" }, { _id: "b" }, { _id: "c" }]);
    expect(llamadas.map((l) => l.url.searchParams.get("cursor"))).toEqual([null, "c2", "c3"]);
  });

  it("posts: sin nextCursor sigue page/pages", async () => {
    const { f, llamadas } = falso((url) => {
      const page = Number(url.searchParams.get("page"));
      return { posts: [{ _id: `p${page}` }], pagination: { page, pages: 3, nextCursor: null } };
    });
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    expect(await z.posts("failed")).toHaveLength(3);
    expect(llamadas).toHaveLength(3);
  });

  it("cuentas, post, historial y seguidores usan sus rutas", async () => {
    const { f, llamadas } = falso((url) => {
      if (url.pathname.endsWith("/accounts")) return fixture("zernio-accounts");
      if (url.pathname.endsWith("/post-timeline")) return fixture("zernio-post-timeline");
      if (url.pathname.endsWith("/follower-stats")) return fixture("zernio-follower-stats");
      return fixture("zernio-post-detalle");
    });
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    expect(await z.cuentas()).toHaveLength(2);
    const detalle = (await z.post("abc")) as { _id: string };
    expect(detalle._id).toBe("6aed3885a0dad4a599e1e5fc");
    expect(await z.historial("p1")).toMatchObject({ postId: "6aed3687a153ccfbefa7203f" });
    expect(await z.seguidores()).toHaveProperty("accounts");
    expect(llamadas.map((l) => l.url.pathname)).toEqual([
      "/api/v1/accounts",
      "/api/v1/posts/abc",
      "/api/v1/analytics/post-timeline",
      "/api/v1/accounts/follower-stats",
    ]);
    expect(llamadas[2]?.url.searchParams.get("postId")).toBe("p1");
  });

  it("solo GET, llave en la cabecera Authorization y nunca en la URL", async () => {
    const { f, llamadas } = falso((url) => {
      if (url.pathname.endsWith("/accounts") || url.pathname.endsWith("/follower-stats")) return { accounts: [] };
      if (url.pathname.includes("/post-timeline") || url.pathname.includes("/posts/")) return { post: {} };
      return { posts: [], pagination: { page: 1, pages: 1, nextCursor: null } };
    });
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    await z.cuentas();
    await z.analitica();
    await z.posts("scheduled");
    await z.post("x");
    await z.historial("x");
    await z.seguidores();
    expect(llamadas.length).toBe(6);
    for (const l of llamadas) {
      expect(l.init?.method).toBe("GET");
      expect(l.url.toString()).not.toContain(KEY);
      expect(new Headers(l.init?.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    }
  });

  it("el cliente no tiene métodos genéricos", () => {
    const z = crearZernio({ apiKey: KEY, fetch: falso(() => ({})).f });
    expect(Object.keys(z).sort()).toEqual(["analitica", "cuentas", "historial", "post", "posts", "seguidores"]);
  });

  it("limita a porMinuto peticiones por ventana de 60 s con reloj falso", async () => {
    let reloj = 1_000_000;
    const esperas: number[] = [];
    const esperar = vi.fn(async (ms: number) => {
      esperas.push(ms);
      reloj += ms;
    });
    const { f, llamadas } = falso(() => ({ accounts: [] }));
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar, ahora: () => reloj, porMinuto: 3 });
    const tiempos: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      await z.cuentas();
      tiempos.push(reloj);
      reloj += 1_000; // cada petición tarda 1 s
    }
    expect(llamadas).toHaveLength(7);
    expect(esperas.length).toBeGreaterThan(0);
    // Ventana deslizante: en ningún intervalo de 60 s hay más de 3 peticiones.
    const sellos: number[] = [];
    let t = 1_000_000;
    // Reconstruye cuándo salió cada petición a partir de las esperas.
    const copia = [...esperas];
    for (let i = 0; i < 7; i += 1) {
      if (i >= 3) t += copia.shift() ?? 0;
      sellos.push(t);
      t += 1_000;
    }
    for (let i = 3; i < sellos.length; i += 1) {
      expect((sellos[i] as number) - (sellos[i - 3] as number)).toBeGreaterThanOrEqual(60_000);
    }
  });

  it("los errores no llevan la llave", async () => {
    const f = (async () => json({ error: `llave inválida ${KEY}` }, 401)) as typeof fetch;
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    const error = (await z.cuentas().catch((e: unknown) => e)) as Error;
    expect(error.message).not.toContain(KEY);
    expect(error.message).toContain("<redactado>");
  });
});
