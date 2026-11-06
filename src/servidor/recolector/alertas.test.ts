import { describe, expect, it } from "vitest";
import {
  alertaDeCodigoMeta,
  alertaLecturaAtrasada,
  alertasDobles,
  alertasIaSinEtiqueta,
  alertasSinVideo,
  type EntradaAlertasCola,
  type PublicacionParaAlertas,
} from "./alertas";

const AHORA = new Date("2026-11-07T12:00:00Z"); // sábado 07:00 en Bogotá
const pub = (id: number, extra: Partial<PublicacionParaAlertas> = {}): PublicacionParaAlertas => ({
  id,
  red: "tiktok",
  estado: "programado",
  reelId: String(id),
  programadoPara: new Date("2026-11-09T00:30:00Z"), // 8-nov 19:30 Bogotá
  marcaIa: null,
  ...extra,
});
const entrada = (publicaciones: PublicacionParaAlertas[], ia: Array<[string, boolean | null]> = []): EntradaAlertasCola => ({
  ahora: AHORA,
  publicaciones,
  etiquetaIaPorReel: new Map(ia),
});

describe("lectura atrasada", () => {
  it("avisa si nunca hubo lectura", () => {
    expect(alertaLecturaAtrasada(AHORA, null).map((a) => a.clave)).toEqual(["lectura:atrasada"]);
  });
  it("avisa pasadas 24 h y no antes", () => {
    expect(alertaLecturaAtrasada(AHORA, new Date(AHORA.getTime() - 25 * 3_600_000))).toHaveLength(1);
    expect(alertaLecturaAtrasada(AHORA, new Date(AHORA.getTime() - 23 * 3_600_000))).toHaveLength(0);
  });
  it("el mensaje lleva la hora de Bogotá", () => {
    const [a] = alertaLecturaAtrasada(AHORA, new Date("2026-11-06T02:00:00Z"));
    expect(a?.mensaje).toContain("2026-11-05 a las 21:00");
  });
});

describe("dos videos el mismo día en la misma red", () => {
  it("lo detecta con la clave del día de Bogotá y la red", () => {
    const a = alertasDobles(
      entrada([
        pub(1, { programadoPara: new Date("2026-11-09T00:30:00Z") }), // 8-nov 19:30
        pub(2, { programadoPara: new Date("2026-11-09T03:00:00Z") }), // 8-nov 22:00
      ]),
    );
    expect(a.map((x) => x.clave)).toEqual(["cola:2026-11-08:tiktok:doble"]);
    expect(a[0]?.mensaje).toContain("el 1 a las 19:30 y el 2 a las 22:00");
  });
  it("otra red, otro día, cancelada o fuera de 14 días no cuentan", () => {
    const a = alertasDobles(
      entrada([
        pub(1),
        pub(2, { red: "instagram" }),
        pub(3, { programadoPara: new Date("2026-11-10T00:30:00Z") }),
        pub(4, { estado: "cancelado" }),
        pub(5, { programadoPara: new Date("2026-11-30T00:30:00Z") }),
        pub(6, { programadoPara: new Date("2026-11-30T01:30:00Z") }),
      ]),
    );
    expect(a).toEqual([]);
  });
  it("el día se mide en Bogotá, no en UTC", () => {
    // 9-nov 02:00Z = 8-nov 21:00 Bogotá; 9-nov 06:00Z = 9-nov 01:00 Bogotá: días distintos
    const a = alertasDobles(
      entrada([pub(1, { programadoPara: new Date("2026-11-09T02:00:00Z") }), pub(2, { programadoPara: new Date("2026-11-09T06:00:00Z") })]),
    );
    expect(a).toEqual([]);
  });
});

describe("día sin video en los próximos 7", () => {
  it("da una alerta por día y red sin publicación, con nivel aviso", () => {
    const a = alertasSinVideo(entrada([pub(1)])); // tiktok 8-nov
    expect(a).toHaveLength(7 * 3 - 1);
    expect(a.every((x) => x.nivel === "aviso")).toBe(true);
    expect(a.map((x) => x.clave)).not.toContain("cola:2026-11-08:tiktok:sin-video");
    expect(a.map((x) => x.clave)).toContain("cola:2026-11-08:instagram:sin-video");
    expect(a.map((x) => x.clave)).toContain("cola:2026-11-07:tiktok:sin-video"); // hoy cuenta
    expect(a.map((x) => x.clave)).not.toContain("cola:2026-11-14:tiktok:sin-video"); // día 8: fuera
  });
  it("una cancelada no cubre el día", () => {
    const a = alertasSinVideo(entrada([pub(1, { estado: "cancelado" })]));
    expect(a.map((x) => x.clave)).toContain("cola:2026-11-08:tiktok:sin-video");
  });
});

describe("IA sin etiqueta", () => {
  const futuro = new Date("2026-11-09T00:30:00Z");
  it("abre si el reel lleva IA y la marca es false o null; no si es true", () => {
    const e = entrada(
      [pub(1, { marcaIa: false }), pub(2, { marcaIa: null }), pub(3, { marcaIa: true })],
      [["1", true], ["2", true], ["3", true]],
    );
    const a = alertasIaSinEtiqueta(e);
    expect(a.map((x) => x.clave)).toEqual(["cola:1:ia-sin-etiqueta", "cola:2:ia-sin-etiqueta"]);
    expect(a[0]?.reelId).toBe("1");
    expect(a[0]?.publicacionId).toBe(1);
  });
  it("no abre si el reel no lleva IA o no se sabe", () => {
    const e = entrada([pub(1, { marcaIa: false }), pub(2, { marcaIa: false })], [["1", false], ["2", null]]);
    expect(alertasIaSinEtiqueta(e)).toEqual([]);
  });
  it("no abre para publicadas, canceladas ni con la hora ya pasada", () => {
    const ia: Array<[string, boolean]> = [["1", true], ["2", true], ["3", true]];
    const e = entrada(
      [
        pub(1, { estado: "publicado" }),
        pub(2, { estado: "cancelado" }),
        pub(3, { programadoPara: new Date("2026-11-06T00:30:00Z") }),
      ],
      ia,
    );
    expect(alertasIaSinEtiqueta(e)).toEqual([]);
    expect(futuro.getTime()).toBeGreaterThan(AHORA.getTime());
  });
  it("un borrador también cuenta", () => {
    expect(alertasIaSinEtiqueta(entrada([pub(1, { estado: "borrador" })], [["1", true]]))).toHaveLength(1);
  });
});

describe("token y permisos de Meta", () => {
  it("190 es token; 10 y 200 son permisos; el resto, nada", () => {
    expect(alertaDeCodigoMeta(190)?.clave).toBe("meta:token");
    expect(alertaDeCodigoMeta(10)?.clave).toBe("meta:permisos");
    expect(alertaDeCodigoMeta(200)?.clave).toBe("meta:permisos");
    expect(alertaDeCodigoMeta(100)).toBeNull();
    expect(alertaDeCodigoMeta(undefined)).toBeNull();
  });
});
