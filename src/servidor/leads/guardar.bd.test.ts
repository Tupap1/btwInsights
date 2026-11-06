import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { reel } from "../db/esquema";
import { guardarLead, listarUltimos } from "./guardar";

const AHORA = new Date("2026-11-06T17:00:00Z");

describe.skipIf(!hayBd)("guardar y listar leads", () => {
  const db = bd();
  beforeAll(async () => {
    await vaciar(db);
    await db.insert(reel).values({ id: "14" });
  });
  afterAll(cerrarBd);

  it("guarda un lead válido y lo lista primero", async () => {
    const r = await guardarLead(db, { fecha: "2026-11-05", canal: "dm", reelId: "14", nota: "pidió precio", resultado: "prueba" }, AHORA);
    expect(r.ok).toBe(true);
    await guardarLead(db, { fecha: "2026-11-06", canal: "calculadora" }, AHORA);
    const lista = await listarUltimos(db, 10);
    expect(lista).toHaveLength(2);
    expect(lista[0]?.fecha).toBe("2026-11-06");
    expect(lista[1]).toMatchObject({ canal: "dm", reelId: "14", resultado: "prueba" });
  });
  it("rechaza un reel que no existe, sin guardar", async () => {
    const r = await guardarLead(db, { fecha: "2026-11-06", canal: "dm", reelId: "999" }, AHORA);
    expect(r).toEqual({ ok: false, mensaje: "Ese reel no existe." });
    expect(await listarUltimos(db, 10)).toHaveLength(2);
  });
  it("rechaza una fecha futura", async () => {
    const r = await guardarLead(db, { fecha: "2026-11-07", canal: "dm" }, AHORA);
    expect(r.ok).toBe(false);
  });
});
