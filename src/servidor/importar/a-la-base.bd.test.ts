import { and, count, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { lectura, publicacion, reel } from "../db/esquema";
import { importar, type Informe } from "./a-la-base";

const DIR = "pruebas/fixtures/btw-videos";

describe.skipIf(!hayBd)("importar btw-videos a la base", () => {
  const db = bd();
  let primero: Informe;
  let segundo: Informe;

  beforeAll(async () => {
    await vaciar(db);
    primero = await importar(db, DIR);
    // Una nota editada a mano después de la primera importación.
    await db.update(reel).set({ notas: "NOTA DE ANDRÉS" }).where(eq(reel.id, "08"));
    segundo = await importar(db, DIR);
  });
  afterAll(cerrarBd);

  it("guarda los reels con los campos clave del 08", async () => {
    const [r] = await db.select().from(reel).where(eq(reel.id, "08"));
    expect(r?.carpeta).toBe("2026-11-07_sab_08_cuanto-montar-lavadero");
    expect(r?.slug).toBe("cuanto-montar-lavadero");
    expect(r?.estado).toBe("listo");
    expect(r?.fechaPlan).toBe("2026-11-07");
    expect(r?.gancho).toBeTruthy();
    expect(r?.formato).not.toBeNull();
    expect(r?.textoTiktok).toBeTruthy();
    expect(r?.textoMeta).toBeTruthy();
  });

  it("el 11 trae un texto distinto por red", async () => {
    const [r] = await db.select().from(reel).where(eq(reel.id, "11"));
    expect(r?.textoTiktok).toBeTruthy();
    expect(r?.textoMeta).toBeTruthy();
    expect(r?.textoTiktok).not.toBe(r?.textoMeta);
    expect(r?.fechaPlan).toBe("2026-11-08");
  });

  it("el 04C-G6 sale de _reserva", async () => {
    const [r] = await db.select().from(reel).where(eq(reel.id, "04C-G6"));
    expect(r?.carpeta).toMatch(/^_reserva\/04C-G6_/);
    expect(r?.slug).toMatch(/^stop-motion/);
  });

  it("guarda las 28 publicaciones de métricas y las 20 de borradores, sin duplicar", async () => {
    const [{ n: total } = { n: 0 }] = await db.select({ n: count() }).from(publicacion);
    const [{ n: borradores } = { n: 0 }] = await db.select({ n: count() }).from(publicacion).where(eq(publicacion.estado, "borrador"));
    expect(total).toBe(48);
    expect(borradores).toBe(20);
  });

  it("deja dos sin asignar: TikTok y Facebook del 28 de octubre", async () => {
    const filas = await db.select().from(publicacion).where(and(isNull(publicacion.reelId), eq(publicacion.estado, "publicado")));
    expect(filas.map((f) => f.red).sort()).toEqual(["facebook", "tiktok"]);
    for (const f of filas) expect(f.publicadoEn?.toISOString().slice(0, 10)).toBe("2026-10-28");
    expect(primero.sinAsignar.map((s) => s.red).sort()).toEqual(["facebook", "tiktok"]);
    expect(primero.sinAsignar.every((s) => s.fecha === "2026-10-28")).toBe(true);
  });

  it("guarda las cifras manuales del 08 en las tres redes", async () => {
    const filas = await db
      .select({ red: publicacion.red, vistas: lectura.vistas, nota: lectura.nota, horas: lectura.horasDesdePublicacion })
      .from(lectura)
      .innerJoin(publicacion, eq(publicacion.id, lectura.publicacionId))
      .where(and(eq(publicacion.reelId, "08"), eq(lectura.fuente, "manual"), eq(lectura.via, "captura")));
    expect(filas.map((f) => f.red).sort()).toEqual(["facebook", "instagram", "tiktok"]);
    for (const f of filas) {
      expect(f.vistas).not.toBeNull();
      expect(f.nota).toBeTruthy();
      expect(f.horas).not.toBeNull();
    }
  });

  it("es idempotente: la segunda importación no agrega publicaciones ni lecturas", async () => {
    expect(primero.publicacionesNuevas).toBe(48);
    expect(primero.reelsCreados).toBeGreaterThan(0);
    expect(segundo.publicacionesNuevas).toBe(0);
    expect(segundo.lecturasNuevas).toBe(0);
    expect(segundo.lecturasRepetidas).toBe(primero.lecturasNuevas + primero.lecturasRepetidas);
    expect(segundo.reelsCreados).toBe(0);
    expect(segundo.sinAsignar).toEqual(primero.sinAsignar);
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(publicacion);
    expect(n).toBe(48);
  });

  it("no pisa una nota editada a mano al reimportar", async () => {
    const [r] = await db.select().from(reel).where(eq(reel.id, "08"));
    expect(r?.notas).toBe("NOTA DE ANDRÉS");
  });

  it("la lectura de métricas anota que la hora es aproximada", async () => {
    const [l] = await db.select().from(lectura).where(eq(lectura.via, "csv")).limit(1);
    expect(l?.nota).toContain("aproximada");
    expect(primero.avisos.some((a) => a.includes("aproximada"))).toBe(true);
  });
});
