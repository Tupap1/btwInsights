import { describe, expect, it } from "vitest";
import { atrasoMs, intervaloMs, porLeer, porLeerAlEntrar } from "./plan";

const H = 3_600_000;
const pub = new Date("2026-11-05T00:30:00Z");
const en = (horas: number) => new Date(pub.getTime() + horas * H);

describe("intervaloMs", () => {
  it("cada 6 h en las primeras 72 h, diario hasta el día 30 y luego semanal", () => {
    expect(intervaloMs(0)).toBe(6 * H);
    expect(intervaloMs(71.9 * H)).toBe(6 * H);
    expect(intervaloMs(72 * H)).toBe(24 * H);
    expect(intervaloMs(30 * 24 * H - 1)).toBe(24 * H);
    expect(intervaloMs(30 * 24 * H)).toBe(7 * 24 * H);
  });
});

describe("porLeer", () => {
  it("lo nunca leído va primero; lo leído hace poco no toca", () => {
    const ps = [
      { publicacionId: 1, publicadoEn: pub, ultimaLectura: en(10) }, // leída a las 10 h; toca a las 16 h
      { publicacionId: 2, publicadoEn: pub, ultimaLectura: null },
      { publicacionId: 3, publicadoEn: pub, ultimaLectura: en(4) }, // tocaba a las 10 h
    ];
    expect(porLeer(ps, en(12)).map((p) => p.publicacionId)).toEqual([2, 3]);
    expect(porLeer(ps, en(16)).map((p) => p.publicacionId)).toEqual([2, 3, 1]);
  });

  it("después de 72 h espera un día entre lecturas", () => {
    const p = { publicacionId: 1, publicadoEn: pub, ultimaLectura: en(80) };
    expect(atrasoMs(p, en(100))).toBeLessThan(0);
    expect(atrasoMs(p, en(104))).toBe(0);
  });
});

describe("porLeerAlEntrar (T25)", () => {
  const H = 3_600_000;
  const MIN = 60_000;
  const ahora = new Date("2026-11-06T15:00:00Z");
  const p = (id: number, edadH: number, hace: number | null) => ({
    publicacionId: id,
    publicadoEn: new Date(ahora.getTime() - edadH * H),
    ultimaLectura: hace === null ? null : new Date(ahora.getTime() - hace),
  });

  it("primero lo que toca por el plan; después las recientes leídas hace más de 10 min, la más vieja primero", () => {
    const ps = [
      p(1, 24 * 5, 30 * MIN), // 5 días, leída hace 30 min: no toca por plan, sí al entrar
      p(2, 10, 7 * H), // 10 h, leída hace 7 h: toca por plan (cada 6 h)
      p(3, 24 * 3, 2 * H), // 3 días, leída hace 2 h: solo al entrar
      p(4, 24 * 2, 5 * MIN), // leída hace 5 min: no
      p(5, 24 * 40, 2 * H), // 40 días, leída hace 2 h: no (más de 30 días y no le toca)
      p(6, 24 * 40, 8 * 24 * H), // 40 días, leída hace 8 días: toca por plan (semanal)
      p(7, 2, null), // nunca leída: toca por plan
    ];
    expect(porLeerAlEntrar(ps, ahora).map((x) => x.publicacionId)).toEqual([7, 6, 2, 3, 1]);
  });

  it("justo en el borde: 10 min exactos sí, 30 días exactos no", () => {
    const ps = [p(1, 24 * 2, 10 * MIN), p(2, 24 * 30, 2 * H)];
    expect(porLeerAlEntrar(ps, ahora).map((x) => x.publicacionId)).toEqual([1]);
  });

  it("no repite: lo que toca por el plan no vuelve a salir entre las recientes", () => {
    const ps = [p(1, 10, 7 * H)];
    expect(porLeerAlEntrar(ps, ahora)).toHaveLength(1);
  });
});
