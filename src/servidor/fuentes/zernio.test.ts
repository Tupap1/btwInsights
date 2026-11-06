import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { crearZernio, cuerpoEditarBorrador } from "./zernio";

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

  it("historial devuelve el timeline real de varios días (acumulado: el último punto es el total de analytics)", async () => {
    const real = fixture("zernio-post-timeline-varios-dias");
    const { f } = falso(() => real);
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    const r = (await z.historial("6aed07f98fef160e5991b10e")) as { timeline: { date: string; views: number }[] };
    const total = (fixture("zernio-analytics")["posts"] as { _id: string; analytics: { views: number } }[]).find(
      (p) => p._id === real["postId"],
    );
    expect(r.timeline.at(-1)?.views).toBe(total?.analytics.views);
    expect(JSON.stringify(real)).not.toMatch(/bearer/i);
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
    await z.postsConComentarios();
    await z.comentariosDePost("x", "cuenta");
    expect(llamadas.length).toBe(8);
    for (const l of llamadas) {
      expect(l.init?.method).toBe("GET");
      expect(l.url.toString()).not.toContain(KEY);
      expect(new Headers(l.init?.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    }
  });

  it("el cliente no tiene métodos genéricos (la única escritura es editarBorrador)", () => {
    const z = crearZernio({ apiKey: KEY, fetch: falso(() => ({})).f });
    expect(Object.keys(z).sort()).toEqual([
      "analitica",
      "comentariosDePost",
      "cuentas",
      "editarBorrador",
      "historial",
      "post",
      "posts",
      "postsConComentarios",
      "seguidores",
    ]);
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

describe("zernio: inbox de comentarios (fase 3, solo GET)", () => {
  it("postsConComentarios: /inbox/comments con limit 50, sin page, y el fixture real (17 posts)", async () => {
    const { f, llamadas } = falso(() => fixture("zernio-inbox-comments"));
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    const r = await z.postsConComentarios();
    expect(r).toHaveLength(17);
    expect(llamadas).toHaveLength(1);
    const u = llamadas[0]?.url;
    expect(u?.pathname).toBe("/api/v1/inbox/comments");
    expect(u?.searchParams.get("limit")).toBe("50");
    expect(u?.searchParams.has("page")).toBe(false);
  });

  it("postsConComentarios: sigue nextCursor tal cual mientras hasMore", async () => {
    const { f, llamadas } = falso((url) => {
      const c = url.searchParams.get("cursor");
      if (!c) return { data: [{ id: "a" }], pagination: { hasMore: true, nextCursor: "x/y+z" } };
      return { data: [{ id: "b" }], pagination: { hasMore: false, nextCursor: null } };
    });
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    expect(await z.postsConComentarios()).toEqual([{ id: "a" }, { id: "b" }]);
    expect(llamadas.map((l) => l.url.searchParams.get("cursor"))).toEqual([null, "x/y+z"]);
  });

  it("comentariosDePost: ruta con el id codificado, accountId y limit 100; hilo real completo", async () => {
    const { f, llamadas } = falso(() => fixture("zernio-inbox-hilo-instagram"));
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    const r = await z.comentariosDePost("18120342799999707", "6aed36858405bb702db92cda");
    expect(r.completo).toBe(true);
    expect(r.comentarios).toHaveLength(1);
    const u = llamadas[0]?.url;
    expect(u?.pathname).toBe("/api/v1/inbox/comments/18120342799999707");
    expect(u?.searchParams.get("accountId")).toBe("6aed36858405bb702db92cda");
    expect(u?.searchParams.get("limit")).toBe("100");
    await z.comentariosDePost("a/b", "c");
    expect(llamadas[1]?.url.pathname).toBe("/api/v1/inbox/comments/a%2Fb");
  });

  it("comentariosDePost: sigue pagination.cursor y marca incompleto si se acaban las páginas", async () => {
    const { f, llamadas } = falso((url) => {
      const c = url.searchParams.get("cursor");
      if (!c) return { comments: [{ id: "1" }], pagination: { hasMore: true, cursor: "p2" } };
      return { comments: [{ id: "2" }], pagination: { hasMore: false } };
    });
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    const r = await z.comentariosDePost("p", "c");
    expect(r).toEqual({ comentarios: [{ id: "1" }, { id: "2" }], completo: true });
    expect(llamadas.map((l) => l.url.searchParams.get("cursor"))).toEqual([null, "p2"]);

    const sinFin = falso(() => ({ comments: [{ id: "x" }], pagination: { hasMore: true, cursor: "otra" } }));
    const z2 = crearZernio({ apiKey: KEY, fetch: sinFin.f, esperar: sinEspera });
    const r2 = await z2.comentariosDePost("p", "c");
    expect(r2.completo).toBe(false);
    expect(sinFin.llamadas.length).toBeLessThanOrEqual(20);

    const sinCursor = falso(() => ({ comments: [{ id: "x" }], pagination: { hasMore: true } }));
    const z3 = crearZernio({ apiKey: KEY, fetch: sinCursor.f, esperar: sinEspera });
    expect((await z3.comentariosDePost("p", "c")).completo).toBe(false);
    expect(sinCursor.llamadas).toHaveLength(1);
  });
});

describe("zernio: editarBorrador (escritura, solo con fetch simulado)", () => {
  const FECHA = new Date("2026-11-20T15:00:00Z");

  it("el cuerpo siempre trae isDraft: true y solo content/scheduledFor, pase lo que pase", () => {
    const sucios: unknown[] = [
      { contenido: "hola", isDraft: false, status: "scheduled", publishNow: true, platforms: [{}], queuedFromProfile: true },
      { contenido: "hola", programadoPara: FECHA, isDraft: false },
      { contenido: null, programadoPara: null },
      { contenido: 5, programadoPara: "2026-11-20" },
      { contenido: "  ", programadoPara: new Date("x") },
      JSON.parse('{"__proto__": {"isDraft": false, "publishNow": true}, "contenido": "x"}'),
      Object.assign(Object.create({ contenido: "heredado", programadoPara: FECHA }), {}),
      { content: "directo", scheduledFor: FECHA.toISOString(), isDraft: false },
    ];
    for (const e of sucios) {
      let cuerpo: Record<string, unknown> | undefined;
      try {
        cuerpo = cuerpoEditarBorrador(e) as unknown as Record<string, unknown>;
      } catch {
        continue; // sin nada que cambiar: error, tampoco hay cuerpo
      }
      expect(cuerpo["isDraft"]).toBe(true);
      expect(Object.keys(cuerpo).every((k) => ["isDraft", "content", "scheduledFor"].includes(k))).toBe(true);
    }
    expect(cuerpoEditarBorrador({ contenido: "hola", programadoPara: FECHA, isDraft: false })).toEqual({
      isDraft: true,
      content: "hola",
      scheduledFor: "2026-11-20T15:00:00.000Z",
    });
  });

  it("sin nada que cambiar es un error", () => {
    for (const e of [{}, null, undefined, "x", 3, { isDraft: false }, { contenido: "" }, { programadoPara: new Date("x") }]) {
      expect(() => cuerpoEditarBorrador(e)).toThrow();
    }
  });

  it("hace PUT /posts/<id codificado> con Bearer y el cuerpo exacto", async () => {
    const llamadas: Llamada[] = [];
    const f = (async (entrada: URL | string, init?: RequestInit) => {
      llamadas.push({ url: new URL(entrada.toString()), init });
      return json({ post: { _id: "x" } });
    }) as typeof fetch;
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    await z.editarBorrador("a/b c?d", { contenido: "nuevo", programadoPara: FECHA });
    expect(llamadas).toHaveLength(1);
    const l = llamadas[0];
    expect(l?.init?.method).toBe("PUT");
    expect(l?.url.pathname).toBe("/api/v1/posts/a%2Fb%20c%3Fd");
    expect(l?.url.search).toBe("");
    const h = l?.init?.headers as Record<string, string>;
    expect(h["Authorization"]).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(l?.init?.body))).toEqual({
      isDraft: true,
      content: "nuevo",
      scheduledFor: "2026-11-20T15:00:00.000Z",
    });
  });

  it("un 4xx no reintenta y el error no lleva la llave", async () => {
    let n = 0;
    const f = (async () => {
      n += 1;
      return json({ error: `clave ${KEY} inválida` }, 400);
    }) as typeof fetch;
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    const e = await z.editarBorrador("p1", { contenido: "x" }).catch((x: unknown) => x);
    expect(n).toBe(1);
    expect(String((e as Error).message)).not.toContain(KEY);
    expect(String((e as Error).message)).toContain("HTTP 400");
  });

  it("un 429 o un 500 tampoco se reintentan en una escritura; el GET sigue reintentando", async () => {
    let n = 0;
    const f = (async () => {
      n += 1;
      return json({}, n === 1 ? 500 : 200);
    }) as typeof fetch;
    const z = crearZernio({ apiKey: KEY, fetch: f, esperar: sinEspera });
    await expect(z.editarBorrador("p1", { contenido: "x" })).rejects.toThrow();
    expect(n).toBe(1);
    n = 0;
    await z.post("p1");
    expect(n).toBe(2);
  });

  it("el GET sigue siendo GET y sin cuerpo", async () => {
    const llamadas: Llamada[] = [];
    const f = (async (entrada: URL | string, init?: RequestInit) => {
      llamadas.push({ url: new URL(entrada.toString()), init });
      return json({ accounts: [] });
    }) as typeof fetch;
    await crearZernio({ apiKey: KEY, fetch: f }).cuentas();
    expect(llamadas[0]?.init?.method).toBe("GET");
    expect(llamadas[0]?.init?.body).toBeUndefined();
  });
});
