import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { idea, reel } from "../db/esquema";
import { importarIdeasYGuiones } from "./ideas-a-la-base";

const DIR = "pruebas/fixtures/btw-videos/guiones";

describe.skipIf(!hayBd)("importar ideas y guiones a la base", () => {
  const db = bd();
  beforeAll(async () => {
    await vaciar(db);
    await db.insert(reel).values(["08", "11", "12", "13", "TERROR02"].map((id) => ({ id })));
  });
  afterAll(cerrarBd);

  it("la primera vez entran 14 ideas y 5 guiones, con avisos por lo que no tiene reel", async () => {
    const i = await importarIdeasYGuiones(db, DIR);
    expect(i.ideasNuevas).toBe(14);
    expect(i.guionesPuestos).toBe(5);
    expect(i.avisos.length).toBeGreaterThan(0);
    const [g] = await db.select().from(reel).where(eq(reel.id, "12"));
    expect(g?.guion).toContain("¿Te están robando?");
    const [cuatro] = await db.select().from(idea).where(eq(idea.fuente, "ideas-2026-11-05.md#4"));
    expect(cuatro?.puntaje).toBe(12);
  });

  it("re-importar no duplica ni pisa un guion editado ni una idea ya pasada a reel", async () => {
    await db.update(reel).set({ guion: "MI GUION" }).where(eq(reel.id, "08"));
    await db.update(idea).set({ estado: "en_reel", reelId: "08", titulo: "EDITADA" }).where(eq(idea.fuente, "ideas-2026-11-05.md#1"));
    await db.update(idea).set({ gancho: "viejo" }).where(eq(idea.fuente, "ideas-2026-11-05.md#2"));
    const i = await importarIdeasYGuiones(db, DIR);
    expect(i.ideasNuevas).toBe(0);
    expect(i.guionesPuestos).toBe(0);
    expect((await db.select().from(idea)).length).toBe(14);
    const [r8] = await db.select().from(reel).where(eq(reel.id, "08"));
    expect(r8?.guion).toBe("MI GUION");
    const [i1] = await db.select().from(idea).where(eq(idea.fuente, "ideas-2026-11-05.md#1"));
    expect(i1).toMatchObject({ titulo: "EDITADA", estado: "en_reel", reelId: "08" });
    // Una idea todavía nueva sí se refresca desde el archivo.
    const [i2] = await db.select().from(idea).where(eq(idea.fuente, "ideas-2026-11-05.md#2"));
    expect(i2?.gancho).toContain("Un carro al día");
  });
});
