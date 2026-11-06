// Aprendizajes contra la base de pruebas con los datos de pruebas/fixtures/btw-videos.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { importar } from "../importar/a-la-base";
import { consultarAprendizajes } from "./aprendizajes";

describe.skipIf(!hayBd)("aprendizajes con datos del 6-nov", () => {
  const db = bd();
  beforeAll(async () => {
    await vaciar(db);
    await importar(db, "pruebas/fixtures/btw-videos");
  });
  afterAll(cerrarBd);

  it("cada grupo con videos trae su n y la marca de pocos datos coherente", async () => {
    const a = await consultarAprendizajes(db);
    for (const dim of Object.values(a)) {
      for (const g of dim) {
        for (const c of Object.values(g.redes)) {
          expect(c.pocosDatos).toBe(c.n < 3);
          expect(c.vistas.conDato).toBeLessThanOrEqual(c.n);
        }
      }
    }
  });
});
