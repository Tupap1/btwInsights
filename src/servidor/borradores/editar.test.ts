// Funciones puras de la edición de borradores: fecha de Bogotá y resumen de confirmación.
import { describe, expect, it } from "vitest";
import { armarResumen, fechaBogotaADate } from "./editar";

describe("fechaBogotaADate", () => {
  it("convierte fecha y hora de Bogotá (UTC-5) a un Date", () => {
    expect(fechaBogotaADate("2026-11-20", "19:30")?.toISOString()).toBe("2026-11-21T00:30:00.000Z");
  });
  it("rechaza lo que no es una fecha u hora real", () => {
    expect(fechaBogotaADate("2026-02-30", "10:00")).toBeNull();
    expect(fechaBogotaADate("2026-11-20", "25:00")).toBeNull();
    expect(fechaBogotaADate("20/11/2026", "10:00")).toBeNull();
    expect(fechaBogotaADate("", "")).toBeNull();
  });
});

describe("armarResumen", () => {
  const antes = { texto: "viejo", programadoPara: new Date("2026-11-16T00:30:00Z") };
  it("muestra antes → después de lo que cambia, la red y la fecha en Bogotá", () => {
    const r = armarResumen("instagram", antes, { texto: "nuevo", programadoPara: new Date("2026-11-21T00:30:00Z") });
    expect(r.red).toBe("Instagram");
    expect(r.cambios.map((c) => c.campo)).toEqual(["Texto", "Fecha y hora"]);
    expect(r.cambios[0]).toMatchObject({ antes: "viejo", despues: "nuevo" });
    expect(r.cambios[1]?.antes).toContain("15");
    expect(r.cambios[1]?.antes).toContain("7:30");
    expect(r.cambios[1]?.despues).toContain("20");
    expect(r.cambios[1]?.despues).toContain("7:30");
  });
  it("solo lista lo que de verdad cambia", () => {
    const r = armarResumen("tiktok", antes, { texto: "viejo", programadoPara: new Date("2026-11-21T00:30:00Z") });
    expect(r.cambios.map((c) => c.campo)).toEqual(["Fecha y hora"]);
  });
  it("sin fecha previa dice 'sin fecha' (no inventa)", () => {
    const r = armarResumen("tiktok", { texto: null, programadoPara: null }, { texto: "a", programadoPara: new Date("2026-11-21T00:30:00Z") });
    expect(r.cambios.every((c) => c.antes === "sin dato")).toBe(true);
  });
});
