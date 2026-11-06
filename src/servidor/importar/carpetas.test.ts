import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { leerNombreCarpeta } from "./carpetas";

const RAIZ = path.join(process.cwd(), "pruebas/fixtures/btw-videos/publicar");

describe("leerNombreCarpeta", () => {
  it("separa fecha, día, id y slug de una carpeta con fecha", () => {
    expect(leerNombreCarpeta("2026-10-29_jue_04C-G1_cuanto-te-quedo_cuerpo-C")).toEqual({
      fecha: "2026-10-29",
      dia: "jue",
      id: "04C-G1",
      slug: "cuanto-te-quedo_cuerpo-C",
    });
  });

  it("toma el id del tercer segmento aunque sea corto", () => {
    expect(leerNombreCarpeta("2026-11-06_vie_09b_mi-lavadero")).toEqual({
      fecha: "2026-11-06",
      dia: "vie",
      id: "09b",
      slug: "mi-lavadero",
    });
  });

  it("lee una carpeta de _reserva sin fecha ni día", () => {
    expect(leerNombreCarpeta("04C-G6_stop-motion_cuerpo-C")).toEqual({
      fecha: null,
      dia: null,
      id: "04C-G6",
      slug: "stop-motion_cuerpo-C",
    });
  });

  it("devuelve null si no encaja", () => {
    expect(leerNombreCarpeta("")).toBeNull();
    expect(leerNombreCarpeta("sin-guiones-bajos")).toBeNull();
    expect(leerNombreCarpeta("2026-11-06_vie_09b")).toBeNull();
    expect(leerNombreCarpeta("2026-11-06_09b_mi-lavadero")).toBeNull();
    expect(leerNombreCarpeta("2026-11-06")).toBeNull();
  });

  it("lee todas las carpetas reales de publicar y de _reserva", () => {
    const carpetas = readdirSync(RAIZ).filter((e) => statSync(path.join(RAIZ, e)).isDirectory());
    const reserva = readdirSync(path.join(RAIZ, "_reserva"));
    const todas = [...carpetas.filter((c) => c !== "_reserva" && c !== "metricas"), ...reserva];
    expect(todas.length).toBeGreaterThan(0);
    for (const nombre of todas) {
      const leido = leerNombreCarpeta(nombre);
      expect(leido, nombre).not.toBeNull();
    }
  });

  it("coincide con las claves de carpetas.json", () => {
    const claves = Object.keys(
      JSON.parse(readFileSync(path.join(RAIZ, "carpetas.json"), "utf8")) as Record<string, unknown>,
    );
    expect(claves.length).toBeGreaterThan(0);
    for (const clave of claves) {
      const leido = leerNombreCarpeta(clave);
      expect(leido, clave).not.toBeNull();
      if (leido === null) continue;
      if (clave.startsWith("2026-")) {
        expect(leido.fecha, clave).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(leido.dia, clave).toMatch(/^[a-z]{3}$/);
      } else {
        expect(leido.fecha, clave).toBeNull();
      }
    }
  });
});
