import { describe, expect, it } from "vitest";
import { calcularRespondido } from "./comentarios";

describe("calcularRespondido", () => {
  it("true: alguna respuesta guardada es de la cuenta", () => {
    expect(calcularRespondido({ respuestas: 3, guardadas: [{ esPropio: false }, { esPropio: true }] })).toBe(true);
  });

  it("true aunque la plataforma cuente más respuestas de las guardadas", () => {
    expect(calcularRespondido({ respuestas: 9, guardadas: [{ esPropio: true }] })).toBe(true);
  });

  it("false: ninguna es de la cuenta y se conocen todas (respuestas <= guardadas)", () => {
    expect(calcularRespondido({ respuestas: 0, guardadas: [] })).toBe(false);
    expect(calcularRespondido({ respuestas: 2, guardadas: [{ esPropio: false }, { esPropio: false }] })).toBe(false);
    expect(calcularRespondido({ respuestas: 1, guardadas: [{ esPropio: false }, { esPropio: false }] })).toBe(false);
  });

  it("null: faltan respuestas por conocer, no se adivina", () => {
    expect(calcularRespondido({ respuestas: 3, guardadas: [{ esPropio: false }] })).toBeNull();
    expect(calcularRespondido({ respuestas: 1, guardadas: [] })).toBeNull();
  });

  it("null: la plataforma no dijo cuántas respuestas hay y no hay una propia", () => {
    expect(calcularRespondido({ respuestas: null, guardadas: [{ esPropio: false }] })).toBeNull();
    expect(calcularRespondido({ respuestas: null, guardadas: [] })).toBeNull();
  });
});
