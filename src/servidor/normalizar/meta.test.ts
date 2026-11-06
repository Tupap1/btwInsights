import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MetricasMeta } from "../tipos";
import { metaCuentaFacebook, metaCuentaInstagram, metaMediaInstagramAPost, metaReelFacebookAPost } from "./meta";

const leer = (nombre: string): unknown => JSON.parse(readFileSync(new URL(`../../../pruebas/fixtures/api/${nombre}`, import.meta.url), "utf8"));
const ahora = new Date("2026-11-06T12:00:00Z");

interface Insights {
  data: Array<{ name: string; values?: Array<{ value?: unknown }>; total_value?: { value?: unknown } }>;
}
/** Arma MetricasMeta desde un "insights-todas": values[0].value ?? total_value.value. */
const metricasDe = (nombre: string): MetricasMeta => {
  const m: MetricasMeta = {};
  for (const d of (leer(nombre) as Insights).data) m[d.name] = { ok: true, valor: d.values?.[0]?.value ?? d.total_value?.value };
  return m;
};

const reelsFb = (leer("meta-fb-reels.json") as { data: Array<Record<string, unknown>> }).data;
const mediaIg = (leer("meta-ig-media.json") as { data: Array<Record<string, unknown>> }).data;

describe("metaReelFacebookAPost", () => {
  it("normaliza todos los reels del fixture, con y sin métricas", () => {
    expect(reelsFb.length).toBeGreaterThan(0);
    const m = metricasDe("meta-fb-insights-todas.json");
    for (const reel of reelsFb) {
      const sin = metaReelFacebookAPost(reel, {}, ahora);
      expect(sin.lectura).toBeNull();
      expect(sin.publicacion.red).toBe("facebook");
      expect(sin.publicacion.enlace).toMatch(/^https:\/\/www\.facebook\.com\/reel\/\d+\/$/);
      const con = metaReelFacebookAPost(reel, m, ahora);
      expect(con.lectura?.fuente).toBe("meta");
    }
  });

  it("calcula las cifras del primer reel desde el fixture", () => {
    const r = metaReelFacebookAPost(reelsFb[0], metricasDe("meta-fb-insights-todas.json"), ahora);
    const c = r.lectura!.cifras;
    expect(r.publicacion).toMatchObject({
      origen: "meta",
      postIdPlataforma: "1091172913760322",
      enlace: "https://www.facebook.com/reel/1091172913760322/",
      duracionS: 43.285,
      estado: "publicado",
      zernioPostId: null,
    });
    expect(r.publicacion.publicadoEn).toEqual(new Date("2026-11-05T18:37:25Z"));
    expect(r.lectura!.datoActualizadoEn).toEqual(ahora);
    expect(c.vistas).toBe(196);
    expect(c.reproduccionesConRepeticion).toBe(236);
    expect(c.tiempoPromedioS).toBe(6.778);
    expect(c.tiempoTotalS).toBe(1328.665);
    expect(c.comentarios).toBe(1);
    expect(c.compartidos).toBe(0); // Meta omite los ceros: SHARE no vino
    expect(c.interacciones).toBe(1);
    expect(c.meGusta).toBe(2);
    expect(c.completos).toBeNull(); // el fixture no trae total_video_complete_views
    expect(c.alcance).toBeNull();
    expect(c.pctSalta3s).toBeNull();
    expect(r.lectura!.reacciones).toEqual({ REACTION_LIKE: 2 });
    expect(r.lectura!.errores).toEqual([]);
  });

  it("social_actions con COMMENT y SHARE; reacciones sumadas; completos", () => {
    const m: MetricasMeta = {
      post_video_social_actions: { ok: true, valor: { COMMENT: 1, SHARE: 2 } },
      post_video_likes_by_reaction_type: { ok: true, valor: { REACTION_LIKE: 3, REACTION_LOVE: 1 } },
      total_video_complete_views: { ok: true, valor: 9 },
    };
    const c = metaReelFacebookAPost(reelsFb[0], m, ahora).lectura!.cifras;
    expect(c.comentarios).toBe(1);
    expect(c.compartidos).toBe(2);
    expect(c.interacciones).toBe(3);
    expect(c.meGusta).toBe(4);
    expect(c.completos).toBe(9);
  });

  it("una métrica con error queda en null y su mensaje va a errores (nunca 0)", () => {
    const m: MetricasMeta = {
      blue_reels_play_count: { ok: true, valor: 10 },
      post_video_social_actions: { ok: false, error: "(#100) The value must be a valid insights metric" },
      post_video_likes_by_reaction_type: { ok: true, valor: undefined },
    };
    const r = metaReelFacebookAPost(reelsFb[0], m, ahora);
    const c = r.lectura!.cifras;
    expect(c.vistas).toBe(10);
    expect(c.comentarios).toBeNull();
    expect(c.compartidos).toBeNull();
    expect(c.interacciones).toBeNull();
    expect(c.meGusta).toBeNull();
    expect(r.lectura!.reacciones).toBeNull();
    expect(r.lectura!.errores).toEqual(["post_video_social_actions: (#100) The value must be a valid insights metric"]);
  });

  it("sin id lanza un error que no copia datos", () => {
    expect(() => metaReelFacebookAPost({ description: "secreto" }, {}, ahora)).toThrow(/forma inesperada/);
    expect(() => metaReelFacebookAPost({ description: "secreto" }, {}, ahora)).not.toThrow(/secreto/);
  });
});

describe("metaMediaInstagramAPost", () => {
  it("normaliza todos los medios del fixture", () => {
    expect(mediaIg.length).toBeGreaterThan(0);
    const m = metricasDe("meta-ig-insights-todas.json");
    for (const media of mediaIg) {
      const r = metaMediaInstagramAPost(media, m, ahora);
      if (media["media_product_type"] === "REELS") {
        expect(r?.publicacion.red).toBe("instagram");
        expect(r?.lectura?.fuente).toBe("meta");
      } else expect(r).toBeNull();
    }
  });

  it("calcula las cifras del primer reel desde el fixture", () => {
    const r = metaMediaInstagramAPost(mediaIg[0], metricasDe("meta-ig-insights-todas.json"), ahora)!;
    const c = r.lectura!.cifras;
    expect(r.publicacion.enlace).toBe("https://www.instagram.com/reel/DfXsc6Kjwib/");
    expect(r.publicacion.publicadoEn).toEqual(new Date("2026-11-05T18:39:26Z"));
    expect(r.publicacion.duracionS).toBeNull();
    expect(c).toMatchObject({
      vistas: 1275,
      alcance: 1048,
      meGusta: 29,
      comentarios: 1,
      compartidos: 2,
      guardados: 4,
      interacciones: 36,
      tiempoPromedioS: 17.677,
      tiempoTotalS: 18986.157,
      pctSalta3s: null,
      ret3s: null,
      seguidoresGanados: null,
    });
    expect(r.lectura!.datoActualizadoEn).toEqual(ahora);
    expect(r.lectura!.curva).toBeNull();
  });

  it("devuelve null si no es REELS y errores por métrica", () => {
    expect(metaMediaInstagramAPost({ ...mediaIg[0], media_product_type: "FEED" }, {}, ahora)).toBeNull();
    const m: MetricasMeta = { views: { ok: true, valor: 5 }, reach: { ok: false, error: "no disponible" } };
    const r = metaMediaInstagramAPost(mediaIg[0], m, ahora)!;
    expect(r.lectura!.cifras.vistas).toBe(5);
    expect(r.lectura!.cifras.alcance).toBeNull();
    expect(r.lectura!.errores).toEqual(["reach: no disponible"]);
  });
});

describe("cuentas de Meta", () => {
  it("Facebook e Instagram", () => {
    expect(metaCuentaFacebook(leer("meta-fb-pagina.json"), ahora)).toEqual({
      red: "facebook",
      cuenta: "1412423015288087",
      fuente: "meta",
      leidoEn: ahora,
      seguidores: 1,
      publicaciones: null,
    });
    expect(metaCuentaInstagram(leer("meta-ig-cuenta.json"), ahora)).toEqual({
      red: "instagram",
      cuenta: "17841446002302741",
      fuente: "meta",
      leidoEn: ahora,
      seguidores: 7,
      publicaciones: 8,
    });
    expect(metaCuentaInstagram({}, ahora).seguidores).toBeNull();
  });
});
