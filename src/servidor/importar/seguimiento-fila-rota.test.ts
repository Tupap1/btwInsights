import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leerSeguimiento } from "./seguimiento";

// Caso real del 5-nov: una celda con coma sin comillas ("No (aviso…; Andrés, 5-nov)") deja la fila con 26 columnas.
describe("seguimiento.csv con una fila mal formada", () => {
  const original = readFileSync(join(process.cwd(), "pruebas/fixtures/btw-videos/publicar/seguimiento.csv"), "utf8");
  const lineas = original.split(/\r?\n/);
  const i = lineas.findIndex((l) => l.startsWith("2026-11-06,vie,14,"));
  const rota = lineas.map((l, k) => (k === i ? l.replace(",Sí,", ",No (aviso; Andrés, 5-nov),") : l)).join("\n");

  it("salta solo esa fila, avisa con su número y lee las demás", () => {
    const { filas, avisos } = leerSeguimiento(rota);
    expect(filas.find((f) => f.id === "14")).toBeUndefined();
    expect(filas).toHaveLength(leerSeguimiento(original).filas.length - 1);
    expect(avisos.some((a) => a.includes(`línea ${i + 1}`) && a.includes("reel 14") && a.includes("Se saltó"))).toBe(true);
  });
});
