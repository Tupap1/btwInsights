import { describe, expect, it } from "vitest";
import { validarLead } from "./esquema";

// 6-nov-2026 en Bogotá. A las 02:00Z del 7 todavía es el 6 en Bogotá.
const AHORA = new Date("2026-11-07T02:00:00Z");

describe("validarLead", () => {
  it("acepta un lead mínimo y deja lo opcional en null", () => {
    expect(validarLead({ fecha: "2026-11-06", canal: "dm", reelId: "", nota: "", resultado: "" }, AHORA)).toEqual({
      ok: true,
      lead: { fecha: "2026-11-06", canal: "dm", reelId: null, nota: null, resultado: null },
    });
  });
  it("acepta todo completo", () => {
    const r = validarLead({ fecha: "2026-11-01", canal: "whatsapp", reelId: "14", nota: " pidió precio ", resultado: "prueba" }, AHORA);
    expect(r).toEqual({
      ok: true,
      lead: { fecha: "2026-11-01", canal: "whatsapp", reelId: "14", nota: "pidió precio", resultado: "prueba" },
    });
  });
  it("rechaza canal y resultado desconocidos", () => {
    expect(validarLead({ fecha: "2026-11-06", canal: "correo" }, AHORA).ok).toBe(false);
    expect(validarLead({ fecha: "2026-11-06", canal: "dm", resultado: "quizás" }, AHORA).ok).toBe(false);
  });
  it("rechaza una fecha futura en Bogotá, pero acepta hoy en Bogotá aunque en UTC ya sea mañana", () => {
    expect(validarLead({ fecha: "2026-11-07", canal: "dm" }, AHORA).ok).toBe(false);
    expect(validarLead({ fecha: "2026-11-06", canal: "dm" }, AHORA).ok).toBe(true);
  });
  it("rechaza fechas mal escritas o que no existen", () => {
    expect(validarLead({ fecha: "6/11/2026", canal: "dm" }, AHORA).ok).toBe(false);
    expect(validarLead({ fecha: "2026-02-31", canal: "dm" }, AHORA).ok).toBe(false);
  });
  it("la nota admite 500 caracteres y no 501", () => {
    expect(validarLead({ fecha: "2026-11-06", canal: "dm", nota: "a".repeat(500) }, AHORA).ok).toBe(true);
    expect(validarLead({ fecha: "2026-11-06", canal: "dm", nota: "a".repeat(501) }, AHORA).ok).toBe(false);
  });
});
