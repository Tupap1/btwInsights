import { describe, expect, it } from "vitest";
import { compararConMediana, mediana } from "./estadistica";

describe("mediana", () => {
  it("de una cantidad impar es el del medio", () => {
    expect(mediana([5, 1, 3])).toBe(3);
  });
  it("de una cantidad par es el promedio de los dos del medio", () => {
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
  });
  it("ignora los null (no los cuenta como 0)", () => {
    expect(mediana([null, 10, null, 20, 30])).toBe(20);
  });
  it("sin valores es null", () => {
    expect(mediana([])).toBeNull();
    expect(mediana([null, null])).toBeNull();
  });
});

describe("compararConMediana", () => {
  it("verde arriba y rojo abajo", () => {
    expect(compararConMediana(150, 100)).toEqual({ tono: "arriba", atipico: false });
    expect(compararConMediana(60, 100)).toEqual({ tono: "abajo", atipico: false });
    expect(compararConMediana(100, 100)).toEqual({ tono: "igual", atipico: false });
  });
  it("atípico: más del doble o menos de la mitad", () => {
    expect(compararConMediana(201, 100)).toEqual({ tono: "arriba", atipico: true });
    expect(compararConMediana(200, 100).atipico).toBe(false);
    expect(compararConMediana(49, 100)).toEqual({ tono: "abajo", atipico: true });
    expect(compararConMediana(50, 100).atipico).toBe(false);
  });
  it("sin valor o sin mediana útil no se compara", () => {
    expect(compararConMediana(null, 100)).toEqual({ tono: null, atipico: false });
    expect(compararConMediana(10, null)).toEqual({ tono: null, atipico: false });
    expect(compararConMediana(10, 0)).toEqual({ tono: null, atipico: false });
  });
});
