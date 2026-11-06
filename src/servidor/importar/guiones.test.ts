import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leerGuiones } from "./guiones";

const leerF = (n: string) => readFileSync(`pruebas/fixtures/btw-videos/guiones/${n}`, "utf8");
const IDS = new Set(["08", "09b", "11", "12", "13", "14", "17", "18", "19", "20", "21", "TERROR02"]);

describe("leerGuiones", () => {
  it("un archivo con id al inicio va a su reel", () => {
    const r = leerGuiones([{ nombre: "08-cuanto-montar-lavadero.md", texto: leerF("08-cuanto-montar-lavadero.md") }], IDS);
    expect(r.avisos).toEqual([]);
    expect(r.guiones).toHaveLength(1);
    expect(r.guiones[0]?.reelId).toBe("08");
    expect(r.guiones[0]?.texto).toContain("Tienes 15 millones");
  });
  it("09b no se confunde con 09", () => {
    const r = leerGuiones([{ nombre: "09b-mi-lavadero.md", texto: leerF("09b-mi-lavadero.md") }], IDS);
    expect(r.guiones.map((g) => g.reelId)).toEqual(["09b"]);
  });
  it("11-13 se parte en tres, cada uno solo con lo suyo", () => {
    const r = leerGuiones([{ nombre: "11-13-borradores.md", texto: leerF("11-13-borradores.md") }], IDS);
    expect(r.guiones.map((g) => g.reelId)).toEqual(["11", "12", "13"]);
    const g11 = r.guiones[0]?.texto ?? "";
    expect(g11).toContain("El cuaderno");
    expect(g11).not.toContain("¿Te están robando?");
    const g13 = r.guiones[2]?.texto ?? "";
    expect(g13).not.toContain("Lo que más subiría");
  });
  it("17-20 se parte por sus encabezados (incluye el 21)", () => {
    const r = leerGuiones([{ nombre: "17-20-primer-lote.md", texto: leerF("17-20-primer-lote.md") }], IDS);
    expect(r.guiones.map((g) => g.reelId)).toEqual(["17", "18", "19", "20", "21"]);
    expect(r.guiones[4]?.texto).not.toContain("Lo que falta de las 12 ideas");
  });
  it("una sección cuyo reel no existe se salta sola, con aviso", () => {
    const ids = new Set(["11", "13"]);
    const r = leerGuiones([{ nombre: "11-13-borradores.md", texto: leerF("11-13-borradores.md") }], ids);
    expect(r.guiones.map((g) => g.reelId)).toEqual(["11", "13"]);
    expect(r.avisos).toHaveLength(1);
  });
  it("un archivo múltiple sin secciones claras se salta con aviso", () => {
    const r = leerGuiones([{ nombre: "11-13-x.md", texto: "# Algo\n\nSin secciones." }], IDS);
    expect(r.guiones).toEqual([]);
    expect(r.avisos).toHaveLength(1);
  });
  it("una sección repetida (ambigua) se salta todo el archivo con aviso", () => {
    const t = "## 11 · A\ntexto\n## 11 · B\notro\n";
    const r = leerGuiones([{ nombre: "11-13-x.md", texto: t }], IDS);
    expect(r.guiones).toEqual([]);
    expect(r.avisos[0]).toMatch(/11/);
  });
  it("elige-uno-terror-02 va a TERROR02; el 01 (sin reel) y la entrevista se saltan con aviso", () => {
    const r = leerGuiones(
      [
        { nombre: "elige-uno-terror-01.md", texto: leerF("elige-uno-terror-01.md") },
        { nombre: "elige-uno-terror-02.md", texto: leerF("elige-uno-terror-02.md") },
        { nombre: "entrevista-cuantos-carros.md", texto: leerF("entrevista-cuantos-carros.md") },
      ],
      IDS,
    );
    expect(r.guiones.map((g) => g.reelId)).toEqual(["TERROR02"]);
    expect(r.avisos).toHaveLength(2);
  });
  it("un id que no existe en la base se salta con aviso; los ideas-*.md no son guiones", () => {
    const r = leerGuiones(
      [
        { nombre: "99-nada.md", texto: "# x" },
        { nombre: "ideas-2026-11-05.md", texto: leerF("ideas-2026-11-05.md") },
      ],
      IDS,
    );
    expect(r.guiones).toEqual([]);
    expect(r.avisos).toHaveLength(1);
  });
});
