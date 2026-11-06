import { describe, expect, it } from "vitest";
import { origenPermitido } from "./origen";

describe("origenPermitido", () => {
  const O = "https://insights.btw-one.com";
  it("en producción exige que Origin sea WEBAUTHN_ORIGEN", () => {
    expect(origenPermitido({ produccion: true, esperado: O, recibido: O })).toBe(true);
    expect(origenPermitido({ produccion: true, esperado: O, recibido: "https://malo.com" })).toBe(false);
    expect(origenPermitido({ produccion: true, esperado: O, recibido: null })).toBe(false);
    expect(origenPermitido({ produccion: true, esperado: undefined, recibido: O })).toBe(false);
  });
  it("en desarrollo no revisa", () => {
    expect(origenPermitido({ produccion: false, esperado: undefined, recibido: null })).toBe(true);
  });
});
