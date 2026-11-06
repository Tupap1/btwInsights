import { describe, expect, it } from "vitest";
import { cifrasVacias, type Fuente } from "../tipos";
import {
  OBJETIVO_48H,
  OBJETIVO_7D,
  OBJETIVO_ULTIMA,
  cifrasDePublicacion,
  lecturaMasCercana,
  sinDato,
  sumaIgFb,
  type LecturaDato,
} from "./cifras";

const dia = (d: number, h = 0) => new Date(Date.UTC(2026, 10, d, h));

function lectura(fuente: Fuente, horas: number | null, parcial: Partial<LecturaDato> = {}): LecturaDato {
  return {
    ...cifrasVacias(),
    fuente,
    via: fuente === "manual" ? "captura" : "api",
    datoActualizadoEn: dia(1, horas ?? 0),
    horasDesdePublicacion: horas,
    ...parcial,
  };
}

describe("lecturaMasCercana", () => {
  it("escoge la de horas más cercanas y no marca aprox. dentro de 12 h", () => {
    const c = lecturaMasCercana([lectura("meta", 20), lectura("meta", 40), lectura("meta", 100)], 48);
    expect(c?.horasReales).toBe(40);
    expect(c?.aprox).toBe(false);
  });

  it("marca aprox. con su hora real cuando la más cercana está a más de 12 h", () => {
    const c = lecturaMasCercana([lectura("meta", 10), lectura("meta", 100)], 48);
    expect(c?.horasReales).toBe(10);
    expect(c?.aprox).toBe(true);
    // 12 h justas todavía no es aproximada.
    expect(lecturaMasCercana([lectura("meta", 36)], 48)?.aprox).toBe(false);
    expect(lecturaMasCercana([lectura("meta", 35.9)], 48)?.aprox).toBe(true);
  });

  it("ignora las lecturas sin horas y devuelve null si no queda ninguna", () => {
    expect(lecturaMasCercana([lectura("meta", null)], 48)).toBeNull();
    expect(lecturaMasCercana([], 48)).toBeNull();
  });

  it("a 7 días mide contra 168 h", () => {
    const c = lecturaMasCercana([lectura("zernio", 48), lectura("zernio", 150), lectura("zernio", 216)], 168);
    expect(c?.horasReales).toBe(150);
  });
});

describe("qué fuente manda", () => {
  it("TikTok: todo de Zernio, y el % que pasa del 3 es ret3s", () => {
    const r = cifrasDePublicacion(
      "tiktok",
      [
        lectura("zernio", 48, { vistas: 1000, tiempoPromedioS: 6, pctCompleto: 12, ret3s: 71 }),
        lectura("meta", 48, { vistas: 99999 }),
      ],
      OBJETIVO_48H,
    );
    expect(r.vistas).toEqual({ valor: 1000, fuente: "zernio", datoActualizadoEn: dia(1, 48) });
    expect(r.pctPasa3s.valor).toBe(71);
    expect(r.pctPasa3s.fuente).toBe("zernio");
  });

  it("Instagram: vistas de Meta y % que pasa del 3 = 100 − pctSalta3s de Zernio", () => {
    const r = cifrasDePublicacion(
      "instagram",
      [
        lectura("meta", 48, { vistas: 1275, meGusta: 30, guardados: 4, tiempoPromedioS: 7.5 }),
        lectura("zernio", 48, { vistas: 918, pctSalta3s: 40 }),
      ],
      OBJETIVO_48H,
    );
    expect(r.vistas.valor).toBe(1275);
    expect(r.vistas.fuente).toBe("meta");
    expect(r.meGusta.fuente).toBe("meta");
    expect(r.pctPasa3s).toMatchObject({ valor: 60, fuente: "zernio" });
  });

  it("Facebook: el % que pasa del 3 queda sin dato", () => {
    const r = cifrasDePublicacion("facebook", [lectura("meta", 48, { vistas: 500 }), lectura("zernio", 48, { pctSalta3s: 30 })], OBJETIVO_48H);
    expect(r.vistas.valor).toBe(500);
    expect(r.pctPasa3s).toEqual(sinDato);
  });

  it("Facebook: una lectura manual llena el % que pasa del 3 y va rotulada manual", () => {
    const r = cifrasDePublicacion(
      "facebook",
      [lectura("meta", 48, { vistas: 500 }), lectura("manual", 48, { ret3s: 55 })],
      OBJETIVO_48H,
    );
    expect(r.pctPasa3s).toMatchObject({ valor: 55, fuente: "manual" });
    expect(r.vistas.fuente).toBe("meta");
  });

  it("una lectura manual no pisa a la API cuando la API tiene el dato en ese momento", () => {
    const r = cifrasDePublicacion(
      "instagram",
      [lectura("meta", 48, { vistas: 700 }), lectura("manual", 48, { vistas: 650 })],
      OBJETIVO_48H,
    );
    expect(r.vistas).toMatchObject({ valor: 700, fuente: "meta" });
  });

  it("la manual entra cuando no hay API para ese momento", () => {
    const r = cifrasDePublicacion("instagram", [lectura("manual", 48, { vistas: 650 })], OBJETIVO_48H);
    expect(r.vistas).toMatchObject({ valor: 650, fuente: "manual" });
  });

  it("la manual también gana si la API más cercana está a más de 12 h", () => {
    const r = cifrasDePublicacion(
      "instagram",
      [lectura("meta", 10, { vistas: 100 }), lectura("manual", 48, { vistas: 650 })],
      OBJETIVO_48H,
    );
    expect(r.vistas).toMatchObject({ valor: 650, fuente: "manual" });
  });

  it("sin API ni manual en ese momento, usa la API lejana y la marca aprox. con su hora real", () => {
    const r = cifrasDePublicacion("tiktok", [lectura("zernio", 31, { vistas: 400 })], OBJETIVO_48H);
    expect(r.vistas.valor).toBe(400);
    expect(r.aprox).toBe(true);
    expect(r.aproxHoras.vistas).toBe(31);
    expect(r.horasReales).toBe(31);
  });

  it("a 7 días usa la lectura más cercana a 168 h", () => {
    const r = cifrasDePublicacion(
      "tiktok",
      [lectura("zernio", 48, { vistas: 100 }), lectura("zernio", 170, { vistas: 900 }), lectura("zernio", 216, { vistas: 1000 })],
      OBJETIVO_7D,
    );
    expect(r.vistas.valor).toBe(900);
    expect(r.aprox).toBe(false);
  });

  it("última lectura: la más reciente de la fuente que manda", () => {
    const r = cifrasDePublicacion(
      "instagram",
      [lectura("meta", 48, { vistas: 100 }), lectura("meta", 200, { vistas: 300 }), lectura("zernio", 300, { vistas: 5 })],
      OBJETIVO_ULTIMA,
    );
    expect(r.vistas.valor).toBe(300);
    expect(r.vistas.fuente).toBe("meta");
  });

  it("nunca pone 0 donde la fuente no dio el dato", () => {
    const r = cifrasDePublicacion("instagram", [lectura("meta", 48, { vistas: 10 })], OBJETIVO_48H);
    expect(r.guardados).toEqual(sinDato);
    expect(r.pctCompleto).toEqual(sinDato);
  });

  it("sin lecturas todo queda sin dato", () => {
    const r = cifrasDePublicacion("tiktok", [], OBJETIVO_ULTIMA);
    expect(r.vistas).toEqual(sinDato);
    expect(r.horasReales).toBeNull();
  });
});

describe("columna IG + FB", () => {
  const c = (valor: number | null, fuente: Fuente | null, h: number) => ({
    valor,
    fuente,
    datoActualizadoEn: valor === null ? null : dia(1, h),
  });

  it("suma las vistas de Meta de las dos, con la fecha del dato más viejo", () => {
    expect(sumaIgFb(c(1275, "meta", 10), c(300, "meta", 5))).toEqual({ valor: 1575, fuente: "meta", datoActualizadoEn: dia(1, 5) });
  });

  it("si falta una de las dos queda sin dato", () => {
    expect(sumaIgFb(c(1275, "meta", 10), c(null, null, 0))).toEqual(sinDato);
    expect(sumaIgFb(c(null, null, 0), c(300, "meta", 5))).toEqual(sinDato);
  });

  it("si una no es de Meta (manual o Zernio) queda sin dato", () => {
    expect(sumaIgFb(c(1275, "meta", 10), c(300, "manual", 5))).toEqual(sinDato);
  });
});
