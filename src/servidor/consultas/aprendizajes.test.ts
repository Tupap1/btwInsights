// Aprendizajes: agrupación por gancho, formato, voz y variables; lectura a 48 h y umbral de 3 videos.
import { describe, expect, it } from "vitest";
import { cifrasVacias, type Fuente, type Red } from "../tipos";
import { armarAprendizajes, dividirVariables, MINIMO_VIDEOS } from "./aprendizajes";
import type { LecturaDato } from "./cifras";
import type { Datos, PublicacionFila, ReelFila } from "./datos";

const t = (iso: string) => new Date(iso);

function reel(id: string, p: Partial<ReelFila>): ReelFila {
  return {
    id,
    gancho: null,
    formato: null,
    voz: null,
    duracionS: 20,
    variablesProbadas: null,
    avisos: [],
    estado: "listo",
    creadoEn: t("2026-11-01T00:00:00Z"),
    actualizadoEn: t("2026-11-01T00:00:00Z"),
    ...p,
  } as unknown as ReelFila;
}

let seq = 0;
function pub(reelId: string, red: Red, p: Partial<PublicacionFila> = {}): PublicacionFila {
  seq += 1;
  return {
    id: seq,
    reelId,
    red,
    estado: "publicado",
    publicadoEn: t("2026-11-01T12:00:00Z"),
    duracionS: null,
    ...p,
  } as unknown as PublicacionFila;
}

function lect(fuente: Fuente, horas: number | null, c: Partial<LecturaDato>): LecturaDato {
  return {
    ...cifrasVacias(),
    fuente,
    via: "api",
    datoActualizadoEn: t("2026-11-03T12:00:00Z"),
    horasDesdePublicacion: horas,
    ...c,
  };
}

function datos(reels: ReelFila[], pubs: PublicacionFila[], lecs: Record<number, LecturaDato[]>): Datos {
  return {
    reels,
    publicaciones: pubs,
    lecturasPorPublicacion: new Map(Object.entries(lecs).map(([k, v]) => [Number(k), v])),
  };
}

describe("dividirVariables", () => {
  it("separa por coma o punto y coma, recorta y descarta vacíos", () => {
    expect(dividirVariables("hook corto,  CTA al final; ; música")).toEqual(["hook corto", "CTA al final", "música"]);
    expect(dividirVariables(null)).toEqual([]);
    expect(dividirVariables("  ")).toEqual([]);
  });
});

describe("armarAprendizajes", () => {
  it("agrupa por formato y cuenta solo videos con lectura a 48 h", () => {
    const rs = [reel("1", { formato: "dialogo" }), reel("2", { formato: "dialogo" }), reel("3", { formato: "dialogo" })];
    const ps = rs.map((r) => pub(r.id, "tiktok"));
    const lecs: Record<number, LecturaDato[]> = {
      [ps[0]!.id]: [lect("zernio", 48, { vistas: 100, tiempoPromedioS: 10, ret3s: 80, guardados: 2, compartidos: 3 })],
      [ps[1]!.id]: [lect("zernio", 40, { vistas: 300, tiempoPromedioS: 5, ret3s: 60, guardados: 1, compartidos: 1 })],
      // a 100 h: más de 12 h lejos de 48 h, no es lectura válida a 48 h
      [ps[2]!.id]: [lect("zernio", 100, { vistas: 9999 })],
    };
    const r = armarAprendizajes(datos(rs, ps, lecs));
    const g = r.formato.find((x) => x.clave === "dialogo");
    const c = g!.redes.tiktok;
    expect(c.n).toBe(2);
    expect(c.vistas.mediana).toBe(200);
    expect(c.vistas.fuentes).toEqual(["zernio"]);
    expect(c.tiempoPct.mediana).toBe(37.5); // (10/20 y 5/20) -> 50 y 25
    expect(c.pasa3s.mediana).toBe(70);
    expect(c.guardadosCompartidos.mediana).toBe(3.5); // 5 y 2
  });

  it("con menos de 3 videos marca pocos datos; con 3 ya no", () => {
    expect(MINIMO_VIDEOS).toBe(3);
    const rs = [reel("1", { voz: "andres" }), reel("2", { voz: "andres" }), reel("3", { voz: "andres" })];
    const ps = rs.map((r) => pub(r.id, "tiktok"));
    const lecs = Object.fromEntries(ps.map((p) => [p.id, [lect("zernio", 48, { vistas: 10 })]]));
    expect(armarAprendizajes(datos(rs.slice(0, 2), ps.slice(0, 2), lecs)).voz[0]!.redes.tiktok.pocosDatos).toBe(true);
    expect(armarAprendizajes(datos(rs, ps, lecs)).voz[0]!.redes.tiktok.pocosDatos).toBe(false);
  });

  it("sin duración, el tiempo como % queda sin dato (no 0)", () => {
    const rs = [reel("1", { formato: "otro", duracionS: null })];
    const ps = [pub("1", "tiktok")];
    const r = armarAprendizajes(datos(rs, ps, { [ps[0]!.id]: [lect("zernio", 48, { vistas: 5, tiempoPromedioS: 8 })] }));
    expect(r.formato[0]!.redes.tiktok.tiempoPct.mediana).toBeNull();
    expect(r.formato[0]!.redes.tiktok.vistas.mediana).toBe(5);
  });

  it("usa la duración de la publicación si el reel no la tiene", () => {
    const rs = [reel("1", { formato: "otro", duracionS: null })];
    const ps = [pub("1", "tiktok", { duracionS: 40 })];
    const r = armarAprendizajes(datos(rs, ps, { [ps[0]!.id]: [lect("zernio", 48, { tiempoPromedioS: 10 })] }));
    expect(r.formato[0]!.redes.tiktok.tiempoPct.mediana).toBe(25);
  });

  it("Instagram: % que pasa de 3 s es 100 − pctSalta3s (Zernio); Facebook queda sin dato", () => {
    const rs = [reel("1", { formato: "otro" })];
    const ps = [pub("1", "instagram"), pub("1", "facebook")];
    const lecs = {
      [ps[0]!.id]: [lect("meta", 48, { vistas: 50 }), lect("zernio", 48, { pctSalta3s: 30 })],
      [ps[1]!.id]: [lect("meta", 48, { vistas: 20 })],
    };
    const r = armarAprendizajes(datos(rs, ps, lecs));
    expect(r.formato[0]!.redes.instagram.pasa3s.mediana).toBe(70);
    expect(r.formato[0]!.redes.facebook.pasa3s.mediana).toBeNull();
    expect(r.formato[0]!.redes.facebook.vistas.fuentes).toEqual(["meta"]);
  });

  it("guardados + compartidos necesita los dos datos", () => {
    const rs = [reel("1", { formato: "otro" })];
    const ps = [pub("1", "tiktok")];
    const r = armarAprendizajes(datos(rs, ps, { [ps[0]!.id]: [lect("zernio", 48, { vistas: 1, guardados: 4, compartidos: null })] }));
    expect(r.formato[0]!.redes.tiktok.guardadosCompartidos.mediana).toBeNull();
  });

  it("variables probadas: cada variable es un grupo y el reel cuenta en todas", () => {
    const rs = [reel("1", { variablesProbadas: "hook corto; CTA" }), reel("2", { variablesProbadas: "Hook corto" })];
    const ps = rs.map((r) => pub(r.id, "tiktok"));
    const lecs = Object.fromEntries(ps.map((p) => [p.id, [lect("zernio", 48, { vistas: 10 })]]));
    const r = armarAprendizajes(datos(rs, ps, lecs));
    expect(r.variables.find((g) => g.clave === "hook corto")!.redes.tiktok.n).toBe(2);
    expect(r.variables.find((g) => g.clave === "cta")!.redes.tiktok.n).toBe(1);
  });

  it("reels sin el atributo van al grupo 'Sin dato'; ganchos iguales (sin importar mayúsculas) se juntan", () => {
    const rs = [reel("1", { gancho: "¿Cuánto cuesta?" }), reel("2", { gancho: " ¿cuánto cuesta? " }), reel("3", {})];
    const ps = rs.map((r) => pub(r.id, "tiktok"));
    const lecs = Object.fromEntries(ps.map((p) => [p.id, [lect("zernio", 48, { vistas: 10 })]]));
    const r = armarAprendizajes(datos(rs, ps, lecs));
    expect(r.gancho.find((g) => g.clave === "¿cuánto cuesta?")!.redes.tiktok.n).toBe(2);
    expect(r.gancho.find((g) => g.etiqueta === "Sin dato")!.redes.tiktok.n).toBe(1);
  });

  it("no cuenta publicaciones sin publicar y omite grupos sin ninguna lectura a 48 h", () => {
    const rs = [reel("1", { formato: "otro" }), reel("2", { formato: "dialogo" })];
    const ps = [pub("1", "tiktok", { estado: "programado", publicadoEn: null }), pub("2", "tiktok")];
    const r = armarAprendizajes(datos(rs, ps, { [ps[1]!.id]: [lect("zernio", null, { vistas: 5 })] }));
    expect(r.formato).toEqual([]);
  });
});
