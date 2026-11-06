import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ErrorFuente } from "./http";
import { crearMeta } from "./meta";

const fixture = (nombre: string): Record<string, unknown> =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../pruebas/fixtures/api/${nombre}.json`, import.meta.url)), "utf8")) as Record<string, unknown>;

const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });

type Llamada = { url: URL; init: RequestInit | undefined };

function falso(responder: (url: URL, n: number) => { cuerpo: unknown; estado?: number }) {
  const llamadas: Llamada[] = [];
  const f = (async (entrada: URL | string | Request, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : entrada.toString());
    llamadas.push({ url, init });
    const r = responder(url, llamadas.length);
    return json(r.cuerpo, r.estado ?? 200);
  }) as typeof fetch;
  return { f, llamadas };
}

const TOKEN = "EAAB_token_secreto_de_prueba";
const sinEspera = async () => {};
const crear = (f: typeof fetch) =>
  crearMeta({ token: TOKEN, pageId: "PAG1", igUserId: "IG1", fetch: f, esperar: sinEspera });

describe("meta", () => {
  it("reelsFacebook pide fields y limit 50, y pagina con cursors.after sin seguir paging.next", async () => {
    const { f, llamadas } = falso((url) => {
      const after = url.searchParams.get("after");
      if (!after)
        return {
          cuerpo: {
            data: [{ id: "1" }],
            paging: { cursors: { before: "b", after: "A2" }, next: "https://graph.facebook.com/v25.0/PAG1/video_reels?access_token=NOSEGUIR&after=A2" },
          },
        };
      return { cuerpo: { data: [{ id: "2" }], paging: { cursors: { before: "b", after: "A3" } } } };
    });
    const r = await crear(f).reelsFacebook();
    expect(r).toEqual([{ id: "1" }, { id: "2" }]);
    expect(llamadas).toHaveLength(2);
    expect(llamadas[0]?.url.pathname).toBe("/v25.0/PAG1/video_reels");
    expect(llamadas[0]?.url.searchParams.get("fields")).toBe("id,description,created_time,permalink_url,length");
    expect(llamadas[0]?.url.searchParams.get("limit")).toBe("50");
    expect(llamadas[1]?.url.searchParams.get("after")).toBe("A2");
    expect(llamadas.every((l) => !l.url.toString().includes("NOSEGUIR"))).toBe(true);
  });

  it("con los fixtures reales de reels e Instagram basta una llamada", async () => {
    const { f, llamadas } = falso((url) => ({
      cuerpo: fixture(url.pathname.includes("video_reels") ? "meta-fb-reels" : "meta-ig-media"),
    }));
    const meta = crear(f);
    expect(await meta.reelsFacebook()).toHaveLength(11);
    expect(await meta.mediaInstagram()).toHaveLength(8);
    expect(llamadas[1]?.url.pathname).toBe("/v25.0/IG1/media");
    expect(llamadas[1]?.url.searchParams.get("fields")).toBe("id,caption,media_product_type,timestamp,permalink");
  });

  it("mediaInstagram pagina igual", async () => {
    const { f, llamadas } = falso((url) =>
      url.searchParams.has("after")
        ? { cuerpo: { data: [{ id: "b" }] } }
        : { cuerpo: { data: [{ id: "a" }], paging: { cursors: { after: "X" }, next: "https://x" } } },
    );
    expect(await crear(f).mediaInstagram()).toEqual([{ id: "a" }, { id: "b" }]);
    expect(llamadas[1]?.url.searchParams.get("after")).toBe("X");
  });

  it("metricas pide todas juntas y lee values[0].value", async () => {
    const { f, llamadas } = falso(() => ({ cuerpo: fixture("meta-fb-insights-todas") }));
    const nombres = ["blue_reels_play_count", "fb_reels_total_plays", "post_video_social_actions"];
    const r = await crear(f).metricas("V1", "facebook", nombres);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url.pathname).toBe("/v25.0/V1/video_insights");
    expect(llamadas[0]?.url.searchParams.get("metric")).toBe(nombres.join(","));
    expect(r["blue_reels_play_count"]).toEqual({ ok: true, valor: 196 });
    expect(r["post_video_social_actions"]).toEqual({ ok: true, valor: { COMMENT: 1 } });
  });

  it("metricas de Instagram usa /insights y total_value como respaldo", async () => {
    const { f, llamadas } = falso(() => ({
      cuerpo: { data: [{ name: "metrica_total", total_value: { value: 12 } }, ...(fixture("meta-ig-insights-todas")["data"] as unknown[])] },
    }));
    const r = await crear(f).metricas("M1", "instagram", ["metrica_total", "views"]);
    expect(llamadas[0]?.url.pathname).toBe("/v25.0/M1/insights");
    expect(r["metrica_total"]).toEqual({ ok: true, valor: 12 });
    expect(r["views"]).toEqual({ ok: true, valor: 1275 });
  });

  it("una métrica pedida que no viene queda como error", async () => {
    const { f } = falso(() => ({ cuerpo: fixture("meta-fb-insights-todas") }));
    const r = await crear(f).metricas("V1", "facebook", ["fb_reels_total_plays", "total_video_complete_views"]);
    expect(r["fb_reels_total_plays"]).toMatchObject({ ok: true });
    expect(r["total_video_complete_views"]).toEqual({ ok: false, error: "no vino en la respuesta" });
  });

  it("ante el error 100 pide una por una y solo falla la inválida", async () => {
    const { f, llamadas } = falso((url) => {
      const metrica = url.searchParams.get("metric") ?? "";
      if (metrica.includes(",") || metrica === "metrica_mala") return { cuerpo: fixture("meta-fb-insight-error"), estado: 400 };
      return { cuerpo: fixture(`meta-fb-insight-${metrica}`) };
    });
    const r = await crear(f).metricas("V1", "facebook", ["fb_reels_total_plays", "metrica_mala", "post_video_avg_time_watched"]);
    expect(llamadas.map((l) => l.url.searchParams.get("metric"))).toEqual([
      "fb_reels_total_plays,metrica_mala,post_video_avg_time_watched",
      "fb_reels_total_plays",
      "metrica_mala",
      "post_video_avg_time_watched",
    ]);
    expect(r["fb_reels_total_plays"]).toEqual({ ok: true, valor: 236 });
    expect(r["post_video_avg_time_watched"]).toEqual({ ok: true, valor: 6778 });
    const mala = r["metrica_mala"];
    expect(mala?.ok).toBe(false);
    expect(mala && !mala.ok ? mala.error : "").toContain("valid insights metric");
  });

  it("reintenta ante el error 613 y ante 429", async () => {
    const { f, llamadas } = falso((_u, n) => {
      if (n === 1) return { cuerpo: { error: { code: 613, message: "Calls to this api have exceeded the rate limit." } }, estado: 400 };
      if (n === 2) return { cuerpo: {}, estado: 429 };
      return { cuerpo: fixture("meta-fb-pagina") };
    });
    expect(await crear(f).cuentaFacebook()).toMatchObject({ followers_count: 1 });
    expect(llamadas).toHaveLength(3);
  });

  it("cuentaFacebook y cuentaInstagram piden sus campos", async () => {
    const { f, llamadas } = falso((url) => ({ cuerpo: fixture(url.pathname.endsWith("PAG1") ? "meta-fb-pagina" : "meta-ig-cuenta") }));
    const meta = crear(f);
    expect(await meta.cuentaFacebook()).toMatchObject({ fan_count: 1 });
    expect(await meta.cuentaInstagram()).toMatchObject({ media_count: 8 });
    expect(llamadas[0]?.url.searchParams.get("fields")).toBe("followers_count,fan_count");
    expect(llamadas[1]?.url.searchParams.get("fields")).toBe("followers_count,media_count");
  });

  it("un servidor que repite el token en su error no lo filtra al mensaje", async () => {
    const { f } = falso(() => ({
      cuerpo: { error: { code: 190, message: `Invalid OAuth access token: ${TOKEN}` } },
      estado: 401,
    }));
    const error = (await crear(f).cuentaFacebook().catch((e: unknown) => e)) as ErrorFuente;
    expect(error).toBeInstanceOf(ErrorFuente);
    expect(error.message).not.toContain(TOKEN);
    expect(error.message).toContain("<redactado>");
    expect(error.estado).toBe(401);
    expect(error.codigo).toBe(190);
  });

  it("en ninguna llamada hay otro método que GET ni el token en la URL", async () => {
    const { f, llamadas } = falso((url) => {
      if (url.pathname.includes("insights")) return { cuerpo: fixture("meta-fb-insights-todas") };
      if (url.pathname.endsWith("PAG1") || url.pathname.endsWith("IG1")) return { cuerpo: {} };
      return { cuerpo: { data: [{ id: "x" }], paging: { cursors: { after: url.searchParams.has("after") ? "" : "Z" }, next: "https://x" } } };
    });
    const meta = crear(f);
    await meta.reelsFacebook();
    await meta.mediaInstagram();
    await meta.metricas("V1", "facebook", ["fb_reels_total_plays"]);
    await meta.metricas("M1", "instagram", ["views"]);
    await meta.cuentaFacebook();
    await meta.cuentaInstagram();
    expect(llamadas.length).toBeGreaterThanOrEqual(8);
    for (const l of llamadas) {
      expect(l.init?.method).toBe("GET");
      expect(l.url.toString()).not.toContain(TOKEN);
      expect(l.url.searchParams.has("access_token")).toBe(false);
      expect(new Headers(l.init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    }
  });
});
