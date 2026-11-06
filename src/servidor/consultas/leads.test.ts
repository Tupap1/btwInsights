import { describe, expect, it } from "vitest";
import { cifrasDeLeads, inicioSemana, leadsPorCanal, leadsPorSemana, type LeadFila } from "./leads";

const lead = (fecha: string, canal: LeadFila["canal"], creadoEn = "2026-11-06T15:00:00Z"): LeadFila => ({
  fecha,
  canal,
  creadoEn: new Date(creadoEn),
});

describe("inicioSemana", () => {
  it("devuelve el lunes de la semana (lunes a domingo)", () => {
    expect(inicioSemana("2026-11-06")).toBe("2026-11-02"); // viernes
    expect(inicioSemana("2026-11-02")).toBe("2026-11-02"); // lunes
    expect(inicioSemana("2026-11-08")).toBe("2026-11-02"); // domingo
    expect(inicioSemana("2026-11-09")).toBe("2026-11-09");
  });
});

describe("leadsPorSemana", () => {
  const filas = [
    lead("2026-11-02", "dm"),
    lead("2026-11-08", "dm"),
    lead("2026-11-09", "calculadora"),
    lead("2026-10-27", "whatsapp"),
  ];
  it("cuenta por semana y por canal, las más recientes primero, con las semanas vacías en 0", () => {
    const r = leadsPorSemana(filas, "2026-11-10", 3);
    expect(r.map((s) => s.semana)).toEqual(["2026-11-09", "2026-11-02", "2026-10-26"]);
    expect(r[0]).toMatchObject({ total: 1, porCanal: { calculadora: 1, dm: 0, comentario: 0, whatsapp: 0 } });
    expect(r[1]).toMatchObject({ total: 2, porCanal: { dm: 2 } });
    expect(r[2]).toMatchObject({ total: 1, porCanal: { whatsapp: 1 } });
  });
  it("una semana sin leads cuenta 0", () => {
    const r = leadsPorSemana([lead("2026-10-01", "dm")], "2026-11-10", 2);
    expect(r.map((s) => s.total)).toEqual([0, 0]);
  });
});

describe("leadsPorCanal", () => {
  it("cuenta todo el historial por canal, con todos los canales", () => {
    expect(leadsPorCanal([lead("2026-11-02", "dm"), lead("2026-11-03", "dm"), lead("2026-11-04", "comentario")])).toEqual({
      calculadora: 0,
      comentario: 1,
      dm: 2,
      whatsapp: 0,
    });
  });
});

describe("cifrasDeLeads (tarjeta de /hoy)", () => {
  const AHORA = new Date("2026-11-06T17:00:00Z"); // viernes 6 de noviembre en Bogotá
  it("sin ningún lead registrado nunca: sin dato (null), no 0", () => {
    const c = cifrasDeLeads([], AHORA);
    expect(c.actual.valor).toBeNull();
    expect(c.anterior.valor).toBeNull();
    expect(c.actual.fuente).toBeNull();
  });
  it("con leads alguna vez, cuenta la semana actual contra la anterior, fuente manual", () => {
    const c = cifrasDeLeads(
      [lead("2026-11-03", "dm", "2026-11-03T20:00:00Z"), lead("2026-11-05", "dm", "2026-11-05T20:00:00Z"), lead("2026-10-28", "dm", "2026-10-28T20:00:00Z")],
      AHORA,
    );
    expect(c.actual).toEqual({ valor: 2, fuente: "manual", datoActualizadoEn: new Date("2026-11-05T20:00:00Z") });
    expect(c.anterior.valor).toBe(1);
    expect(c.anterior.fuente).toBe("manual");
  });
  it("0 es un conteo real cuando hubo leads en otra época", () => {
    const c = cifrasDeLeads([lead("2026-09-01", "dm", "2026-09-01T20:00:00Z")], AHORA);
    expect(c.actual.valor).toBe(0);
    expect(c.anterior.valor).toBe(0);
    expect(c.actual.fuente).toBe("manual");
  });
  it("un lead de fecha futura (no debería existir) no cuenta en la semana actual si cae en la siguiente", () => {
    const c = cifrasDeLeads([lead("2026-11-09", "dm")], AHORA);
    expect(c.actual.valor).toBe(0);
  });
});
