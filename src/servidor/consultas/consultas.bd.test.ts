// Las consultas de las pantallas contra la base de pruebas, con los datos de pruebas/fixtures/btw-videos.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { importar } from "../importar/a-la-base";
import { consultarCola } from "./cola";
import { consultarDetalle } from "./detalle";
import { consultarHoy } from "./hoy";
import { consultarSinAsignar } from "./sin-asignar";
import { consultarVideos, leerFiltros } from "./videos";

const DIR = "pruebas/fixtures/btw-videos";
// 6-nov-2026, mediodía en Bogotá.
const AHORA = new Date("2026-11-06T17:00:00Z");

describe.skipIf(!hayBd)("consultas de las pantallas", () => {
  const db = bd();

  beforeAll(async () => {
    await vaciar(db);
    await importar(db, DIR);
  });
  afterAll(cerrarBd);

  describe("/videos", () => {
    it("ordenado por vistas de Instagram, el 10 va primero", async () => {
      const r = await consultarVideos(db, leerFiltros({ orden: "instagram_vistas", dir: "desc" }));
      expect(r.filas[0]?.reel.id).toBe("10");
      expect(r.filas[0]?.redes.instagram?.cifras.vistas.fuente).toBe("meta");
    });

    it("ordenado por vistas de TikTok, va primero '¿Cuánto cuesta montar…' y de fuente Zernio", async () => {
      const r = await consultarVideos(db, leerFiltros({ orden: "tiktok_vistas", dir: "desc" }));
      const primero = r.filas[0];
      expect(primero?.reel.gancho).toMatch(/cuánto cuesta montar/i);
      expect(primero?.redes.tiktok?.cifras.vistas.fuente).toBe("zernio");
    });

    it("lo que no tiene dato va siempre al final, sin importar el sentido", async () => {
      for (const dir of ["asc", "desc"] as const) {
        const r = await consultarVideos(db, leerFiltros({ orden: "instagram_vistas", dir }));
        const valores = r.filas.map((f) => f.redes.instagram?.cifras.vistas.valor ?? null);
        const primerNulo = valores.indexOf(null);
        expect(primerNulo).toBeGreaterThan(0);
        expect(valores.slice(primerNulo).every((v) => v === null)).toBe(true);
      }
    });

    it("la columna IG + FB suma las vistas de Meta de las dos, y queda vacía si falta una", async () => {
      const r = await consultarVideos(db, leerFiltros({}));
      const diez = r.filas.find((f) => f.reel.id === "10");
      const ig = diez?.redes.instagram?.cifras.vistas.valor ?? 0;
      const fb = diez?.redes.facebook?.cifras.vistas.valor ?? 0;
      expect(diez?.igfb.valor).toBe(ig + fb);
      expect(diez?.igfb.fuente).toBe("meta");
      const sinInstagram = r.filas.find((f) => f.reel.id === "04C-G6");
      expect(sinInstagram?.redes.instagram).toBeNull();
      expect(sinInstagram?.igfb.valor).toBeNull();
    });

    it("filtra por red y por fechas", async () => {
      const ig = await consultarVideos(db, leerFiltros({ red: "instagram" }));
      expect(ig.filas.length).toBeGreaterThan(0);
      expect(ig.filas.every((f) => f.redes.instagram !== null)).toBe(true);
      const fechas = await consultarVideos(db, leerFiltros({ desde: "2026-11-05", hasta: "2026-11-05" }));
      expect(fechas.filas.map((f) => f.reel.id).sort()).toEqual(expect.arrayContaining(["09", "09b", "10"]));
      expect(fechas.filas.every((f) => f.fecha === "2026-11-05")).toBe(true);
      expect(fechas.total).toBeGreaterThan(fechas.filas.length);
    });

    it("a 48 h, un video con menos de 36 h sale 'aprox.' con su hora real y sin color", async () => {
      const r = await consultarVideos(db, leerFiltros({ momento: "48h" }));
      const diez = r.filas.find((f) => f.reel.id === "10")?.redes.instagram;
      const h = diez?.aproxHoras.vistas;
      expect(h).toBeDefined();
      expect(h).toBeLessThan(36);
      expect(diez?.comparacion.vistas.tono).toBeNull();
    });

    it("en la última lectura compara contra la mediana de la misma red", async () => {
      const r = await consultarVideos(db, leerFiltros({}));
      const tonos = r.filas.flatMap((f) => (f.redes.tiktok ? [f.redes.tiktok.comparacion.vistas.tono] : []));
      expect(tonos).toContain("arriba");
      expect(tonos).toContain("abajo");
    });
  });

  describe("/videos/[id]", () => {
    it("el 10 trae sus publicaciones, la curva de crecimiento y las cifras con fuente", async () => {
      const d = await consultarDetalle(db, "10");
      expect(d?.reel.id).toBe("10");
      expect(d?.publicaciones.map((p) => p.publicacion.red).sort()).toEqual(["facebook", "instagram", "tiktok"]);
      expect(d?.crecimiento.series.some((s) => s.tipo === "real")).toBe(true);
      for (const fila of d?.crecimiento.filas ?? []) expect(fila.horas).toBeGreaterThan(0);
      const ig = d?.publicaciones.find((p) => p.publicacion.red === "instagram");
      expect(ig?.ultima.vistas.fuente).toBe("meta");
    });

    it("un reel que no existe da null", async () => {
      expect(await consultarDetalle(db, "NO-EXISTE")).toBeNull();
    });

    it("un reel sin publicaciones también se puede abrir", async () => {
      const d = await consultarDetalle(db, "21");
      expect(d?.publicaciones.every((p) => p.publicacion.estado !== "publicado")).toBe(true);
      expect(d?.retencion).toBeNull();
    });
  });

  describe("/cola", () => {
    it("14 días desde hoy; hoy sale el 14 en borrador", async () => {
      const c = await consultarCola(db, AHORA);
      expect(c.dias).toHaveLength(14);
      expect(c.dias[0]?.dia).toBe("2026-11-06");
      const hoy = c.dias[0]?.redes.tiktok ?? [];
      expect(hoy.map((i) => i.reelId)).toContain("14");
      expect(hoy.find((i) => i.reelId === "14")?.estado).toBe("borrador");
    });
  });

  describe("/hoy", () => {
    it("sale hoy el 14 y mañana el 13, con los avisos del reel", async () => {
      const h = await consultarHoy(db, AHORA);
      const catorce = h.salidas.find((s) => s.reelId === "14");
      expect(catorce?.dia).toBe("hoy");
      expect(catorce?.avisos.length).toBeGreaterThan(0);
      expect(h.salidas.find((s) => s.reelId === "13")?.dia).toBe("mañana");
    });

    it("una tarjeta por red; las vistas ganadas salen de la fuente que manda y los leads no existen", async () => {
      const h = await consultarHoy(db, AHORA);
      expect(h.tarjetas.map((t) => t.red)).toEqual(["tiktok", "instagram", "facebook"]);
      const [tiktok, instagram] = h.tarjetas;
      expect(tiktok?.vistasGanadas.actual.fuente).toBe("zernio");
      expect(tiktok?.vistasGanadas.actual.valor).toBeGreaterThan(0);
      expect(instagram?.vistasGanadas.actual.fuente).toBe("meta");
      expect(h.leads.actual.valor).toBeNull();
    });

    it("sin base de comparación no inventa: sin lecturas de cuenta, seguidores nuevos queda sin dato", async () => {
      const h = await consultarHoy(db, AHORA);
      for (const t of h.tarjetas) expect(t.seguidoresNuevos.actual.valor).toBeNull();
    });

    it("el mejor video de la semana es el 10 en Instagram", async () => {
      const h = await consultarHoy(db, AHORA);
      expect(h.mejor?.reelId).toBe("10");
      expect(h.mejor?.red).toBe("instagram");
    });

    it("sin corridas no hay 'última lectura'", async () => {
      const h = await consultarHoy(db, AHORA);
      expect(h.ultimaLectura).toBeNull();
    });
  });

  describe("/sin-asignar", () => {
    it("trae las dos publicaciones del 28 de octubre y la lista de reels", async () => {
      const s = await consultarSinAsignar(db);
      expect(s.publicaciones.map((p) => p.red).sort()).toEqual(["facebook", "tiktok"]);
      expect(s.reels.length).toBeGreaterThan(10);
    });
  });
});
