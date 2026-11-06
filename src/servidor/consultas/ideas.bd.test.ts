import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { idea } from "../db/esquema";
import { consultarIdeas, leerFiltrosIdeas } from "./ideas";

describe("leerFiltrosIdeas", () => {
  it("descarta lo que no sirve", () => {
    expect(leerFiltrosIdeas({ estado: "nueva", formato: "dialogo" })).toEqual({ estado: "nueva", formato: "dialogo" });
    expect(leerFiltrosIdeas({ formato: "raro", estado: "" })).toEqual({ estado: undefined, formato: undefined });
  });
});

describe.skipIf(!hayBd)("consultarIdeas", () => {
  const db = bd();
  beforeAll(async () => {
    await vaciar(db);
    await db.insert(idea).values([
      { titulo: "sin", fuente: "a#1" },
      { titulo: "diez", puntaje: 10, formato: "dialogo", fuente: "a#2" },
      { titulo: "doce", puntaje: 12, formato: "plata_3d", fuente: "a#3" },
      { titulo: "usada", puntaje: 11, estado: "en_reel", fuente: "a#4" },
    ]);
  });
  afterAll(cerrarBd);

  it("ordena por puntaje descendente y deja sin puntaje al final", async () => {
    const r = await consultarIdeas(db, {});
    expect(r.ideas.map((i) => i.titulo)).toEqual(["doce", "usada", "diez", "sin"]);
    expect(r.ideas[3]?.puntaje).toBeNull();
    expect(r.total).toBe(4);
    expect(r.estados).toEqual(["en_reel", "nueva"]);
  });
  it("filtra por estado y por formato", async () => {
    expect((await consultarIdeas(db, { estado: "nueva" })).ideas).toHaveLength(3);
    expect((await consultarIdeas(db, { formato: "dialogo" })).ideas.map((i) => i.titulo)).toEqual(["diez"]);
  });
});
