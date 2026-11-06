import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { leerCalendario } from "./calendario";

const RUTA = path.join(process.cwd(), "pruebas/fixtures/btw-videos/publicar/calendario-zernio.json");

function cargarReal(): unknown {
  return JSON.parse(readFileSync(RUTA, "utf8")) as unknown;
}

function calendarioMinimo(videos: unknown[] = []): unknown {
  return { hora: "19:30", zona: "America/Bogota", videos };
}

const videoBase = {
  id: "14",
  carpeta: "2026-11-06_vie_14_plata-que-se-escapa",
  fecha: "2026-11-06",
  ia: true,
  tiktok: "2026-11-06_14_plata-que-se-escapa.mp4",
};

describe("leerCalendario", () => {
  it("lee calendario-zernio.json real: 10 videos, hora y zona", () => {
    const cal = leerCalendario(cargarReal());
    expect(cal.hora).toBe("19:30");
    expect(cal.zona).toBe("America/Bogota");
    expect(cal.videos).toHaveLength(10);
  });

  it("programadoPara es la fecha y hora en Bogotá (-05:00) como UTC", () => {
    const cal = leerCalendario(cargarReal());
    const primero = cal.videos[0];
    expect(primero?.programadoPara.toISOString()).toBe("2026-11-07T00:30:00.000Z");
    expect(primero?.archivoMeta).toBeNull();
  });

  it("archivoMeta sale del campo meta cuando existe", () => {
    const cal = leerCalendario(cargarReal());
    const el8 = cal.videos.find((v) => v.id === "11");
    expect(el8?.archivoMeta).toBe("2026-11-08_11_el-cuaderno_facebook-instagram.mp4");
    expect(el8?.archivoTiktok).toBe("2026-11-08_11_el-cuaderno_tiktok.mp4");
    expect(el8?.ia).toBe(true);
  });

  it("mapea los campos a los nombres del dominio", () => {
    const [primero] = leerCalendario(calendarioMinimo([videoBase])).videos;
    expect(primero).toEqual({
      id: "14",
      carpeta: "2026-11-06_vie_14_plata-que-se-escapa",
      fecha: "2026-11-06",
      ia: true,
      archivoTiktok: "2026-11-06_14_plata-que-se-escapa.mp4",
      archivoMeta: null,
      programadoPara: new Date("2026-11-07T00:30:00Z"),
    });
  });

  it("cruza el cambio de mes sin problemas", () => {
    const [v] = leerCalendario(calendarioMinimo([{ ...videoBase, fecha: "2026-10-31" }])).videos;
    expect(v?.programadoPara.toISOString()).toBe("2026-11-01T00:30:00.000Z");
  });

  it("rechaza una zona distinta de America/Bogota", () => {
    expect(() => leerCalendario({ hora: "19:30", zona: "UTC", videos: [] })).toThrow();
  });

  it("rechaza una hora mal formada", () => {
    expect(() => leerCalendario({ hora: "7:30pm", zona: "America/Bogota", videos: [] })).toThrow();
    expect(() => leerCalendario({ hora: "25:00", zona: "America/Bogota", videos: [] })).toThrow();
  });

  it("rechaza una fecha que no existe o tiene otra forma", () => {
    expect(() => leerCalendario(calendarioMinimo([{ ...videoBase, fecha: "2026-02-30" }]))).toThrow();
    expect(() => leerCalendario(calendarioMinimo([{ ...videoBase, fecha: "06/11/2026" }]))).toThrow();
  });

  it("rechaza un video sin id o con ia que no es booleano", () => {
    expect(() => leerCalendario(calendarioMinimo([{ ...videoBase, id: "" }]))).toThrow();
    expect(() => leerCalendario(calendarioMinimo([{ ...videoBase, ia: "si" }]))).toThrow();
  });

  it("rechaza algo que no es un objeto", () => {
    expect(() => leerCalendario(null)).toThrow();
    expect(() => leerCalendario("calendario")).toThrow();
  });
});
