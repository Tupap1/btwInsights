import { describe, expect, it } from "vitest";
import {
  formatoDecimal,
  formatoEntero,
  formatoFechaCola,
  formatoFechaHora,
  formatoHora,
  formatoPesos,
  formatoPorcentaje,
  formatoSegundos,
  haceCuanto,
} from "./formato";
import { diaBogota, inicioDiaBogota, sumarDias } from "./tiempo";

// Intl pone un espacio duro entre el signo y la cifra, y otro antes de "%": se normalizan para comparar.
const plano = (s: string) => s.replace(/[  ]/g, " ");

describe("formato es-CO", () => {
  it("punto de miles, también en cuatro cifras", () => {
    expect(formatoEntero(1234)).toBe("1.234");
    expect(formatoEntero(1275)).toBe("1.275");
    expect(formatoEntero(1234567)).toBe("1.234.567");
    expect(formatoEntero(87)).toBe("87");
  });
  it("coma decimal", () => {
    expect(formatoDecimal(12345.67)).toBe("12.345,7");
    expect(plano(formatoPorcentaje(61.25))).toBe("61,3 %");
    expect(plano(formatoSegundos(6.4))).toBe("6,4 s");
  });
  it("pesos con punto de miles y sin centavos", () => {
    expect(plano(formatoPesos(1234567))).toBe("$ 1.234.567");
  });
});

describe("fechas en America/Bogota", () => {
  it("el día de Bogotá va cinco horas atrás de UTC", () => {
    expect(diaBogota(new Date("2026-11-06T04:59:00Z"))).toBe("2026-11-05");
    expect(diaBogota(new Date("2026-11-06T05:00:00Z"))).toBe("2026-11-06");
  });
  it("el inicio del día de Bogotá es a las 05:00 UTC", () => {
    expect(inicioDiaBogota("2026-11-06").toISOString()).toBe("2026-11-06T05:00:00.000Z");
  });
  it("suma días calendario", () => {
    expect(sumarDias("2026-11-28", 3)).toBe("2026-12-01");
    expect(sumarDias("2026-11-06", -13)).toBe("2026-10-24");
  });
  it("la hora sale en Bogotá", () => {
    expect(plano(formatoHora(new Date("2026-11-06T00:30:00Z"))).toLowerCase()).toMatch(/^7:30 p\. ?m\.$/);
    expect(formatoFechaHora(new Date("2026-11-06T00:30:00Z"))).toContain("5");
  });
  it("hace cuánto", () => {
    const ahora = new Date("2026-11-06T12:00:00Z");
    expect(haceCuanto(new Date("2026-11-06T11:30:00Z"), ahora)).toBe("hace 30 min");
    expect(haceCuanto(new Date("2026-11-06T09:00:00Z"), ahora)).toBe("hace 3 h");
    expect(haceCuanto(new Date("2026-11-03T12:00:00Z"), ahora)).toBe("hace 3 d");
  });
});

describe("formatoFechaCola", () => {
  it("sale como 'vie 6 de nov', en minúsculas y sin coma", () => {
    expect(formatoFechaCola(inicioDiaBogota("2026-11-06"))).toBe("vie 6 de nov");
    expect(formatoFechaCola(inicioDiaBogota("2026-12-01"))).toBe("mar 1 de dic");
    expect(formatoFechaCola(inicioDiaBogota("2026-09-12"))).toBe("sáb 12 de sept");
  });
});
