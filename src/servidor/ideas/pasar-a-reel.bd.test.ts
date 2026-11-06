import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { idea, reel } from "../db/esquema";
import { pasarAReel } from "./pasar-a-reel";

describe.skipIf(!hayBd)("pasar una idea a reel", () => {
  const db = bd();
  beforeAll(async () => {
    await vaciar(db);
    await db.insert(reel).values({ id: "10" });
    await db.insert(idea).values([
      { titulo: "Uno", gancho: "G1", formato: "plata_3d", fuente: "t#1" },
      { titulo: "Dos", fuente: "t#2" },
      { titulo: "Tres", fuente: "t#3" },
    ]);
  });
  afterAll(cerrarBd);

  it("crea el reel en estado idea con gancho y formato, y une la idea", async () => {
    const r = await pasarAReel(db, 1, "30");
    expect(r).toEqual({ ok: true, reelId: "30", yaEstaba: false });
    const [rl] = await db.select().from(reel).where(eq(reel.id, "30"));
    expect(rl).toMatchObject({ estado: "idea", gancho: "G1", formato: "plata_3d" });
    const [i] = await db.select().from(idea).where(eq(idea.id, 1));
    expect(i).toMatchObject({ estado: "en_reel", reelId: "30" });
  });

  it("dos pulsaciones a la vez no crean dos reels", async () => {
    const [a, b] = await Promise.all([pasarAReel(db, 2, "31"), pasarAReel(db, 2, "31")]);
    expect(a.ok && b.ok).toBe(true);
    expect((await db.select().from(reel).where(eq(reel.id, "31"))).length).toBe(1);
  });

  it("repetir con otro id no crea otro reel", async () => {
    const r = await pasarAReel(db, 1, "32");
    expect(r.ok).toBe(false);
    expect((await db.select().from(reel).where(eq(reel.id, "32"))).length).toBe(0);
  });

  it("un id que ya existe se rechaza y la idea sigue nueva", async () => {
    const r = await pasarAReel(db, 3, "10");
    expect(r.ok).toBe(false);
    const [i] = await db.select().from(idea).where(eq(idea.id, 3));
    expect(i).toMatchObject({ estado: "nueva", reelId: null });
  });

  it("una idea que no existe se rechaza", async () => {
    expect((await pasarAReel(db, 999, "40")).ok).toBe(false);
  });
});
