import { describe, expect, it } from "vitest";
import { atrasoMs, intervaloMs, porLeer } from "./plan";

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
