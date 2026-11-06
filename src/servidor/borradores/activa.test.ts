import { describe, expect, it } from "vitest";
import { edicionActiva } from "./activa";

describe("edición de borradores (T24: el tablero es solo para ver)", () => {
  it("apagada salvo EDITAR_BORRADORES=1 exacto", () => {
    expect(edicionActiva(undefined)).toBe(false);
    expect(edicionActiva("")).toBe(false);
    expect(edicionActiva("0")).toBe(false);
    expect(edicionActiva("true")).toBe(false);
    expect(edicionActiva("si")).toBe(false);
    expect(edicionActiva("1")).toBe(true);
  });
});
