import { describe, expect, it } from "vitest";
import { sigueEsperando } from "./actualizar-al-entrar-logica";

const desde = Date.parse("2026-11-06T15:00:00Z");
const despues = "2026-11-06T15:00:02.000Z";
const antes = "2026-11-06T14:30:00.000Z";

describe("sigueEsperando (T25)", () => {
  it("mientras haya una lectura en curso, espera (hasta 2 min)", () => {
    expect(sigueEsperando({ enCurso: true, ultima: null }, "iniciada", desde, 5_000)).toBe(true);
    expect(sigueEsperando({ enCurso: true, ultima: null }, "en_curso", desde, 60_000)).toBe(true);
    expect(sigueEsperando({ enCurso: true, ultima: null }, "iniciada", desde, 120_000)).toBe(false);
  });

  it("iniciada: termina cuando la última corrida terminada empezó después del pedido", () => {
    expect(sigueEsperando({ enCurso: false, ultima: { iniciadaEn: despues } }, "iniciada", desde, 4_000)).toBe(false);
  });

  it("iniciada: si todavía no arrancó, espera un poco; a los 10 s se rinde (otra pestaña ganó el candado)", () => {
    expect(sigueEsperando({ enCurso: false, ultima: { iniciadaEn: antes } }, "iniciada", desde, 3_000)).toBe(true);
    expect(sigueEsperando({ enCurso: false, ultima: null }, "iniciada", desde, 3_000)).toBe(true);
    expect(sigueEsperando({ enCurso: false, ultima: { iniciadaEn: antes } }, "iniciada", desde, 10_000)).toBe(false);
  });

  it("en_curso (de otra pestaña o del cron): termina en cuanto deja de estar en curso", () => {
    expect(sigueEsperando({ enCurso: false, ultima: { iniciadaEn: antes } }, "en_curso", desde, 3_000)).toBe(false);
  });
});
