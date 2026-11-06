import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { zernioAnaliticaAPost, zernioColaAPublicaciones, zernioSeguidores } from "./zernio";

const leer = (nombre: string): unknown => JSON.parse(readFileSync(new URL(`../../../pruebas/fixtures/api/${nombre}`, import.meta.url), "utf8"));
const ahora = new Date("2026-11-06T12:00:00Z");

interface Analitica {
  posts: Array<Record<string, unknown> & { platforms: Array<{ platformPostId: string }> }>;
}
const analitica = leer("zernio-analytics.json") as Analitica;
const porPlataforma = (id: string) => {
  const p = analitica.posts.find((x) => x.platforms[0]?.platformPostId === id);
  if (!p) throw new Error("falta el post en el fixture");
  return zernioAnaliticaAPost(p, ahora);
};

describe("zernioAnaliticaAPost", () => {
  it("normaliza todos los posts del fixture sin fallar", () => {
    expect(analitica.posts.length).toBeGreaterThan(0);
    for (const p of analitica.posts) {
      const r = zernioAnaliticaAPost(p, ahora);
      expect(r.lectura?.fuente).toBe("zernio");
      expect(r.lectura?.via).toBe("api");
      expect(r.publicacion.estado).toBe("publicado");
      expect(r.lectura?.errores).toEqual([]);
    }
  });

  it("Instagram: ms a segundos, skip rate ya en porcentaje y datos que Zernio no da en null", () => {
    const r = porPlataforma("18120342799999707");
    const c = r.lectura!.cifras;
    expect(r.publicacion.red).toBe("instagram");
    expect(r.publicacion.cuenta).toBe("btwone.co");
    expect(r.publicacion.enlace).toBe("https://www.instagram.com/reel/DfXsc6Kjwib/");
    expect(r.publicacion.duracionS).toBe(43);
    expect(c.vistas).toBe(918);
    expect(c.alcance).toBe(728);
    expect(c.tiempoPromedioS).toBe(17.677);
    expect(c.tiempoTotalS).toBe(13311.514);
    expect(c.pctSalta3s).toBe(47.4);
    expect(c.seguidoresGanados).toBeNull(); // follows: null
    expect(c.pctCompleto).toBeNull(); // IG manda 0 porque no existe
    expect(c.pctParaTi).toBeNull();
    expect(c.pctNoSeguidores).toBeNull();
    expect(c.ret3s).toBeNull();
    expect(r.lectura!.curva).toBeNull();
    expect(r.lectura!.paisPrincipal).toBeNull();
    expect(r.lectura!.datoActualizadoEn).toEqual(new Date("2026-11-06T02:08:07Z"));
  });

  it("zernioPostId sale de latePostId (null en los externos), nunca de _id", () => {
    for (const p of analitica.posts) {
      expect(zernioAnaliticaAPost(p, ahora).publicacion.zernioPostId).toBeNull();
    }
    const conLate = { ...analitica.posts[0], latePostId: "abc123" };
    expect(zernioAnaliticaAPost(conLate, ahora).publicacion.zernioPostId).toBe("abc123");
  });

  it("TikTok: alcance 0 con vistas > 0 es null; pct 0-100; retención por clave exacta", () => {
    const r = porPlataforma("7704758213807312180");
    const c = r.lectura!.cifras;
    expect(c.vistas).toBe(80);
    expect(c.alcance).toBeNull();
    expect(c.pctCompleto).toBe(3.37);
    expect(c.pctSalta3s).toBeNull(); // reelsSkipRate es solo de Instagram
    expect(c.tiempoPromedioS).toBe(10.13);
    expect(c.tiempoTotalS).toBe(901);
    expect(c.pctParaTi).toBe(97.8);
    expect(c.pctBusqueda).toBe(0);
    expect(c.pctNoSeguidores).toBe(99);
    expect(c.seguidoresGanados).toBe(0);
    expect(c.ret1s).toBe(60);
    expect(c.ret3s).toBe(42);
    expect(c.ret5s).toBe(35);
    expect(c.ret10s).toBe(26);
    expect(r.lectura!.curva?.["0"]).toBe(100);
    expect(r.lectura!.curva?.["43"]).toBe(1);
    expect(Object.keys(r.lectura!.curva!)).toHaveLength(44);
    expect(r.publicacion.duracionS).toBe(43.286);
  });

  it("TikTok con alcance real se respeta, y el país principal es el mayor sin other", () => {
    const r = porPlataforma("7704035139474509076");
    expect(r.lectura!.cifras.alcance).toBe(122);
    expect(r.lectura!.cifras.seguidoresGanados).toBe(1);
    expect(r.lectura!.paisPrincipal).toEqual({ codigo: "CO", pct: 96.3 });
    const otro = porPlataforma("7701968015163772212");
    expect(otro.lectura!.paisPrincipal).toEqual({ codigo: "CO", pct: 90.4 }); // "other" (1%) no cuenta
  });

  it("curva con solo segundos pares: ret1s y ret3s son null, ret10s sale de su clave", () => {
    const c = porPlataforma("7702305446215847174").lectura!;
    expect(c.cifras.ret1s).toBeNull();
    expect(c.cifras.ret3s).toBeNull();
    expect(c.cifras.ret5s).toBeNull();
    expect(c.cifras.ret10s).toBe(7);
    expect(c.curva?.["2"]).toBe(46);
    expect(c.curva?.["3"]).toBeUndefined();
  });

  it("usa leidoEn si no viene lastUpdated, y 'other' solo no da país", () => {
    const p = JSON.parse(JSON.stringify(analitica.posts[0])) as { analytics: Record<string, unknown> };
    delete p.analytics["lastUpdated"];
    p.analytics["audienceCountries"] = { other: 1 };
    const r = zernioAnaliticaAPost(p, ahora);
    expect(r.lectura!.datoActualizadoEn).toEqual(ahora);
    expect(r.lectura!.paisPrincipal).toBeNull();
  });

  it("sin analytics no hay lectura; sin _id lanza un error que no copia datos", () => {
    const sin = { ...analitica.posts[0], analytics: null };
    expect(zernioAnaliticaAPost(sin, ahora).lectura).toBeNull();
    const malo = { ...analitica.posts[0], _id: undefined };
    expect(() => zernioAnaliticaAPost(malo, ahora)).toThrow(/forma inesperada/);
    try {
      zernioAnaliticaAPost(malo, ahora);
    } catch (e) {
      expect((e as Error).message).not.toContain("Montaste");
      expect((e as Error).message).not.toContain("instagram");
    }
    expect(() => zernioAnaliticaAPost("x", ahora)).toThrow();
  });
});

describe("zernioColaAPublicaciones", () => {
  const borradores = leer("zernio-posts-draft.json") as { posts: unknown[] };
  const programados = leer("zernio-posts-scheduled.json") as { posts: unknown[] };

  it("normaliza todos los posts de la cola del fixture", () => {
    for (const p of [...borradores.posts, ...programados.posts]) {
      const v = zernioColaAPublicaciones(p);
      expect(v.length).toBeGreaterThan(0);
      for (const x of v) {
        expect(x.origen).toBe("zernio");
        expect(x.zernioPostId).toBeTruthy();
        expect(x.cuenta).toBeTruthy();
      }
    }
  });

  it("una publicación por plataforma, con etiquetas, estado y programadoPara", () => {
    const v = zernioColaAPublicaciones(borradores.posts[0]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({
      red: "instagram",
      cuenta: "btwone.co",
      zernioPostId: "6aed3885a0dad4a599e1e5fc",
      etiquetas: ["reel-21"],
      estado: "borrador",
      postIdPlataforma: null,
      enlace: null,
      publicadoEn: null,
    });
    expect(v[0]!.programadoPara).toEqual(new Date("2026-11-16T00:30:00.000Z"));
    const prog = zernioColaAPublicaciones(programados.posts[0]);
    expect(prog[0]!.estado).toBe("programado");
    expect(prog[0]!.etiquetas).toEqual(["reel-14"]);
  });

  it("la marca de IA sale de isAiGenerated (Instagram) o video_made_with_ai (TikTok); sin dato, null", () => {
    const todas = borradores.posts.flatMap((p) => zernioColaAPublicaciones(p));
    const ig = todas.filter((x) => x.red === "instagram");
    const tt = todas.filter((x) => x.red === "tiktok");
    expect(ig.length).toBeGreaterThan(0);
    expect(tt.length).toBeGreaterThan(0);
    expect(ig.some((x) => x.marcaIa === true)).toBe(true);
    expect(tt.some((x) => x.marcaIa === true)).toBe(true);
    expect(tt.some((x) => x.marcaIa === false)).toBe(true); // hay un borrador de TikTok con video_made_with_ai: false
    // Cada valor coincide con el dato crudo de su plataforma.
    for (const post of borradores.posts as Array<{ platforms: Array<{ platform: string; platformSpecificData?: Record<string, unknown> }> }>) {
      const v = zernioColaAPublicaciones(post);
      for (const [i, plat] of post.platforms.entries()) {
        const d = plat.platformSpecificData ?? {};
        const tk = d["tiktokSettings"] as Record<string, unknown> | undefined;
        const crudo = plat.platform === "tiktok" ? tk?.["video_made_with_ai"] : d["isAiGenerated"];
        expect(v[i]?.marcaIa).toBe(typeof crudo === "boolean" ? crudo : null);
      }
    }
  });

  it("sin platformSpecificData la marca es null, nunca false", () => {
    const v = zernioColaAPublicaciones({ _id: "x", status: "draft", platforms: [{ platform: "facebook" }] });
    expect(v[0]?.marcaIa).toBeNull();
  });

  it("mapea todos los estados", () => {
    const base = { _id: "x", platforms: [{ platform: "tiktok" }] };
    const casos: Array<[string, string]> = [
      ["draft", "borrador"],
      ["pending_approval", "pendiente_aprobacion"],
      ["scheduled", "programado"],
      ["publishing", "publicando"],
      ["published", "publicado"],
      ["partial", "parcial"],
      ["failed", "fallido"],
      ["cancelled", "cancelado"],
    ];
    for (const [z, d] of casos) expect(zernioColaAPublicaciones({ ...base, status: z })[0]!.estado).toBe(d);
    expect(() => zernioColaAPublicaciones({ ...base, status: "inventado" })).toThrow(/forma inesperada/);
  });

  it("varias plataformas dan varias publicaciones y se ignoran las redes que no seguimos", () => {
    const post = {
      _id: "p1",
      status: "published",
      platforms: [
        { platform: "tiktok", platformPostId: "t1", platformPostUrl: "https://tiktok.com/x" },
        { platform: "youtube" },
        { platform: "facebook", accountId: "abc" },
      ],
    };
    const v = zernioColaAPublicaciones(post);
    expect(v.map((x) => x.red)).toEqual(["tiktok", "facebook"]);
    expect(v[0]).toMatchObject({ postIdPlataforma: "t1", enlace: "https://tiktok.com/x" });
    expect(() => zernioColaAPublicaciones({ status: "draft", platforms: [] })).toThrow(/forma inesperada/);
  });
});

describe("zernioSeguidores", () => {
  it("lee los seguidores por cuenta", () => {
    const r = zernioSeguidores(leer("zernio-follower-stats.json"), ahora);
    expect(r).toEqual([
      { red: "tiktok", cuenta: "btw.inc", fuente: "zernio", leidoEn: ahora, seguidores: 2, publicaciones: null },
      { red: "instagram", cuenta: "btwone.co", fuente: "zernio", leidoEn: ahora, seguidores: 7, publicaciones: null },
    ]);
  });
});
