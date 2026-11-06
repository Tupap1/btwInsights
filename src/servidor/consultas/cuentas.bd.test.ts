// /cuentas y "seguidores nuevos" de /hoy contra la base de pruebas.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { cuentaLectura } from "../db/esquema";
import { consultarCuentas } from "./cuentas";
import { consultarHoy } from "./hoy";

const AHORA = new Date("2026-11-06T17:00:00Z");

describe.skipIf(!hayBd)("cuentas", () => {
  const db = bd();
  beforeAll(async () => {
    await vaciar(db);
    await db.insert(cuentaLectura).values([
      { red: "instagram", cuenta: "btw", fuente: "meta", leidoEn: new Date("2026-11-02T15:00:00Z"), seguidores: 100 },
      { red: "instagram", cuenta: "btw", fuente: "meta", leidoEn: new Date("2026-11-05T15:00:00Z"), seguidores: 109 },
      { red: "tiktok", cuenta: "btw", fuente: "zernio", leidoEn: new Date("2026-11-05T15:00:00Z"), seguidores: 50 },
    ]);
  });
  afterAll(cerrarBd);

  it("serie y última cifra por red", async () => {
    const c = await consultarCuentas(db);
    expect(c.series.map((s) => `${s.red}/${s.fuente}/${s.puntos.length}`)).toEqual(["tiktok/zernio/1", "instagram/meta/2"]);
    expect(c.ultima.instagram.valor).toBe(109);
    expect(c.ultima.facebook.valor).toBeNull();
  });

  it("/hoy: seguidores nuevos con dos lecturas, sin dato con una sola", async () => {
    const h = await consultarHoy(db, AHORA);
    const por = Object.fromEntries(h.tarjetas.map((t) => [t.red, t.seguidoresNuevos.actual.valor]));
    expect(por).toEqual({ tiktok: null, instagram: 9, facebook: null });
  });
});
