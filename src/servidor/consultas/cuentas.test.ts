import { describe, expect, it } from "vitest";
import { seguidoresNuevos, serieSeguidores, ultimaPorRed, type LecturaCuenta } from "./cuentas";

const t = (s: string) => new Date(s);
const l = (red: LecturaCuenta["red"], fuente: LecturaCuenta["fuente"], leidoEn: string, seguidores: number | null, cuenta = "btw"): LecturaCuenta => ({
  red,
  fuente,
  cuenta,
  leidoEn: t(leidoEn),
  seguidores,
});

describe("seguidoresNuevos", () => {
  const desde = t("2026-10-31T05:00:00Z");
  const hasta = t("2026-11-06T17:00:00Z");
  it("última lectura menos primera dentro de la semana, sin interpolar", () => {
    const ls = [
      l("instagram", "meta", "2026-10-30T15:00:00Z", 100), // fuera de la semana: no cuenta
      l("instagram", "meta", "2026-11-01T15:00:00Z", 120),
      l("instagram", "meta", "2026-11-03T15:00:00Z", 125),
      l("instagram", "meta", "2026-11-05T15:00:00Z", 131),
    ];
    expect(seguidoresNuevos(ls, "instagram", "meta", desde, hasta)).toEqual({
      valor: 11,
      fuente: "meta",
      datoActualizadoEn: t("2026-11-05T15:00:00Z"),
    });
  });
  it("con una sola lectura en la semana es null, aunque haya una anterior", () => {
    const ls = [l("instagram", "meta", "2026-10-30T15:00:00Z", 100), l("instagram", "meta", "2026-11-03T15:00:00Z", 125)];
    expect(seguidoresNuevos(ls, "instagram", "meta", desde, hasta).valor).toBeNull();
  });
  it("sin lecturas es sin dato; ignora otra red, otra fuente y lecturas sin seguidores", () => {
    const ls = [
      l("tiktok", "zernio", "2026-11-01T15:00:00Z", 10),
      l("tiktok", "zernio", "2026-11-04T15:00:00Z", 20),
      l("instagram", "zernio", "2026-11-01T15:00:00Z", 1),
      l("instagram", "meta", "2026-11-01T15:00:00Z", null),
      l("instagram", "meta", "2026-11-04T15:00:00Z", 50),
    ];
    expect(seguidoresNuevos([], "instagram", "meta", desde, hasta)).toEqual({ valor: null, fuente: null, datoActualizadoEn: null });
    expect(seguidoresNuevos(ls, "instagram", "meta", desde, hasta).valor).toBeNull();
    expect(seguidoresNuevos(ls, "tiktok", "zernio", desde, hasta).valor).toBe(10);
  });
  it("puede dar negativo (perdió seguidores) y 0 es real", () => {
    const ls = [l("facebook", "meta", "2026-11-01T15:00:00Z", 50), l("facebook", "meta", "2026-11-04T15:00:00Z", 48)];
    expect(seguidoresNuevos(ls, "facebook", "meta", desde, hasta).valor).toBe(-2);
    const iguales = [l("facebook", "meta", "2026-11-01T15:00:00Z", 50), l("facebook", "meta", "2026-11-04T15:00:00Z", 50)];
    expect(seguidoresNuevos(iguales, "facebook", "meta", desde, hasta).valor).toBe(0);
  });
  it("no mezcla cuentas: usa la de la lectura más reciente", () => {
    const ls = [
      l("instagram", "meta", "2026-11-01T15:00:00Z", 1000, "vieja"),
      l("instagram", "meta", "2026-11-02T15:00:00Z", 100, "btw"),
      l("instagram", "meta", "2026-11-04T15:00:00Z", 110, "btw"),
    ];
    expect(seguidoresNuevos(ls, "instagram", "meta", desde, hasta).valor).toBe(10);
  });
  it("el fin de la ventana es exclusivo y el inicio inclusivo", () => {
    const ls = [l("facebook", "meta", "2026-10-31T05:00:00Z", 10), l("facebook", "meta", "2026-11-06T17:00:00Z", 99), l("facebook", "meta", "2026-11-02T00:00:00Z", 13)];
    expect(seguidoresNuevos(ls, "facebook", "meta", desde, hasta).valor).toBe(3);
  });
});

describe("serieSeguidores", () => {
  it("una serie por red y fuente, ordenada por fecha, cada punto con su fuente y fecha; omite los null", () => {
    const ls = [
      l("instagram", "meta", "2026-11-03T15:00:00Z", 125),
      l("instagram", "meta", "2026-11-01T15:00:00Z", 120),
      l("instagram", "meta", "2026-11-02T15:00:00Z", null),
      l("tiktok", "zernio", "2026-11-01T15:00:00Z", 10),
      l("tiktok", "manual", "2026-11-01T16:00:00Z", 11),
    ];
    const s = serieSeguidores(ls);
    expect(s.map((x) => `${x.red}/${x.fuente}`)).toEqual(["tiktok/zernio", "tiktok/manual", "instagram/meta"]);
    const ig = s.find((x) => x.red === "instagram");
    expect(ig?.puntos).toEqual([
      { leidoEn: t("2026-11-01T15:00:00Z"), seguidores: 120, fuente: "meta", cuenta: "btw" },
      { leidoEn: t("2026-11-03T15:00:00Z"), seguidores: 125, fuente: "meta", cuenta: "btw" },
    ]);
  });
  it("sin lecturas, sin series", () => {
    expect(serieSeguidores([])).toEqual([]);
  });
});

describe("ultimaPorRed", () => {
  it("la última cifra de la fuente que manda en cada red, con su fecha", () => {
    const ls = [
      l("instagram", "meta", "2026-11-01T15:00:00Z", 120),
      l("instagram", "meta", "2026-11-05T15:00:00Z", 131),
      l("instagram", "meta", "2026-11-06T15:00:00Z", null),
      l("tiktok", "zernio", "2026-11-04T15:00:00Z", 22),
    ];
    const r = ultimaPorRed(ls);
    expect(r.instagram).toEqual({ valor: 131, fuente: "meta", datoActualizadoEn: t("2026-11-05T15:00:00Z") });
    expect(r.tiktok).toEqual({ valor: 22, fuente: "zernio", datoActualizadoEn: t("2026-11-04T15:00:00Z") });
  });
  it("si la fuente que manda no tiene nada pero otra sí, muestra esa con su propia fuente; si nada, sin dato", () => {
    const r = ultimaPorRed([l("facebook", "manual", "2026-11-05T15:00:00Z", 7)]);
    expect(r.facebook).toEqual({ valor: 7, fuente: "manual", datoActualizadoEn: t("2026-11-05T15:00:00Z") });
    expect(r.tiktok).toEqual({ valor: null, fuente: null, datoActualizadoEn: null });
  });
});
