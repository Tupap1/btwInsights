import { describe, expect, it } from "vitest";
import { decidirAlEntrar } from "./al-entrar";

const ahora = new Date("2026-11-06T15:00:00Z");
const hace = (ms: number) => new Date(ahora.getTime() - ms);
const MIN = 60_000;

describe("decidirAlEntrar (T25)", () => {
  it("sin corridas: iniciar", () => {
    expect(decidirAlEntrar(null, ahora)).toBe("iniciar");
  });

  it("una corrida en curso que empezó hace menos de 10 min: en_curso", () => {
    expect(decidirAlEntrar({ estado: "en_curso", iniciadaEn: hace(3 * MIN) }, ahora)).toBe("en_curso");
  });

  it("una corrida en curso de hace más de 10 min se da por abandonada: iniciar", () => {
    expect(decidirAlEntrar({ estado: "en_curso", iniciadaEn: hace(11 * MIN) }, ahora)).toBe("iniciar");
  });

  it("la última empezó hace menos de 2 min: reciente (sin importar cómo terminó)", () => {
    for (const estado of ["ok", "parcial", "error", "abandonada"] as const) {
      expect(decidirAlEntrar({ estado, iniciadaEn: hace(90_000) }, ahora)).toBe("reciente");
    }
  });

  it("la última empezó hace 2 min o más: iniciar", () => {
    expect(decidirAlEntrar({ estado: "ok", iniciadaEn: hace(2 * MIN) }, ahora)).toBe("iniciar");
    expect(decidirAlEntrar({ estado: "ok", iniciadaEn: hace(60 * MIN) }, ahora)).toBe("iniciar");
  });
});
