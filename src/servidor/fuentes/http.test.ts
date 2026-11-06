import { describe, expect, it, vi } from "vitest";
import { ErrorFuente, pedirJson } from "./http";

const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });

const sinEspera = () => vi.fn(async () => {});

describe("pedirJson", () => {
  it("hace siempre GET y devuelve el JSON", async () => {
    const f = vi.fn(async (_u: unknown, init?: RequestInit) => json({ a: 1, m: init?.method }));
    const r = await pedirJson(new URL("https://x.test/a"), { secretos: [], fetch: f as typeof fetch });
    expect(r).toEqual({ a: 1, m: "GET" });
    expect(f.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("reintenta ante 429 y 503, con espera creciente", async () => {
    const respuestas = [json({}, 429), json({}, 503), json({ ok: true })];
    const f = vi.fn(async () => respuestas.shift() as Response);
    const esperar = sinEspera();
    const r = await pedirJson(new URL("https://x.test/a"), { secretos: [], fetch: f as typeof fetch, esperar });
    expect(r).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(3);
    const [e1, e2] = esperar.mock.calls.map((c) => (c as unknown as number[])[0]);
    expect(e2 as number).toBeGreaterThan(e1 as number);
  });

  it("reintenta errores de Meta 4, 17, 32 y 613 aunque vengan con HTTP 400", async () => {
    for (const code of [4, 17, 32, 613]) {
      const respuestas = [json({ error: { code, message: "limite" } }, 400), json({ ok: code })];
      const f = vi.fn(async () => respuestas.shift() as Response);
      const r = await pedirJson(new URL("https://x.test/a"), { secretos: [], fetch: f as typeof fetch, esperar: sinEspera() });
      expect(r).toEqual({ ok: code });
      expect(f).toHaveBeenCalledTimes(2);
    }
  });

  it("reintenta errores de red y timeout", async () => {
    const f = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }))
      .mockResolvedValueOnce(json({ ok: 1 }));
    const r = await pedirJson(new URL("https://x.test/a"), { secretos: [], fetch: f as typeof fetch, esperar: sinEspera() });
    expect(r).toEqual({ ok: 1 });
  });

  it("no reintenta un 400 normal ni un 404", async () => {
    const f = vi.fn(async () => json({ error: { code: 100, message: "mala" } }, 400));
    await expect(
      pedirJson(new URL("https://x.test/a"), { secretos: [], fetch: f as typeof fetch, esperar: sinEspera() }),
    ).rejects.toMatchObject({ estado: 400, codigo: 100 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("se rinde tras los reintentos con ErrorFuente", async () => {
    const f = vi.fn(async () => json({}, 500));
    const error = await pedirJson(new URL("https://x.test/a"), {
      secretos: [],
      fetch: f as typeof fetch,
      esperar: sinEspera(),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorFuente);
    expect((error as ErrorFuente).estado).toBe(500);
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("el mensaje no lleva la URL, las cabeceras ni los secretos", async () => {
    const secreto = "TOKEN-SUPER-SECRETO-123";
    const f = vi.fn(async () =>
      json({ error: { code: 190, message: `Invalid OAuth access token ${secreto} (Bearer ${secreto})` } }, 401),
    );
    const error = (await pedirJson(new URL("https://x.test/ruta?campo=1"), {
      cabeceras: { Authorization: `Bearer ${secreto}` },
      secretos: [secreto],
      fetch: f as typeof fetch,
      esperar: sinEspera(),
    }).catch((e: unknown) => e)) as ErrorFuente;
    expect(error.message).not.toContain(secreto);
    expect(error.message).toContain("<redactado>");
    expect(error.message).not.toContain("x.test");
    expect(error.message).not.toContain("Authorization");
  });

  it("un error de red no filtra la URL ni el secreto", async () => {
    const secreto = "abc-secreto";
    const f = vi.fn(async () => {
      throw new TypeError(`fetch failed https://x.test/?access_token=${secreto}`);
    });
    const error = (await pedirJson(new URL("https://x.test/"), {
      secretos: [secreto],
      fetch: f as typeof fetch,
      esperar: sinEspera(),
      intentos: 1,
    }).catch((e: unknown) => e)) as ErrorFuente;
    expect(error.message).not.toContain(secreto);
    expect(error.message).not.toContain("x.test");
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("pedirJson: escritura explícita", () => {
  it("sin `escritura` es GET; con ella, PUT con cuerpo JSON y sin reintentos", async () => {
    const f = vi.fn<typeof fetch>(async () => new Response("{}", { status: 503 }));
    await expect(
      pedirJson(new URL("https://x.test/a"), { secretos: [], fetch: f, esperar: async () => {}, escritura: { metodo: "PUT", cuerpo: { a: 1 } } }),
    ).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]?.[1]?.method).toBe("PUT");
    expect(f.mock.calls[0]?.[1]?.body).toBe('{"a":1}');
  });
});
