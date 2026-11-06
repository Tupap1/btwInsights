import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { leerSeguimiento, type FilaSeguimiento } from "./seguimiento";

const real = readFileSync(
  path.join(process.cwd(), "pruebas/fixtures/btw-videos/publicar/seguimiento.csv"),
  "utf8",
);
const { filas, avisos } = leerSeguimiento(real);
const reel = (id: string): FilaSeguimiento => {
  const f = filas.find((x) => x.id === id);
  if (!f) throw new Error(`falta el reel ${id}`);
  return f;
};

describe("leerSeguimiento con los datos reales", () => {
  it("lee las 21 filas", () => {
    expect(filas).toHaveLength(21);
  });

  it("el reel 08: duración 42,9 y 214 vistas en TikTok", () => {
    const f = reel("08");
    expect(f.duracionS).toBe(42.9);
    expect(f.formato).toBe("plata_3d");
    expect(f.cifras48h).toContainEqual(expect.objectContaining({ red: "tiktok", campo: "vistas", valor: 214 }));
    expect(f.cifras48h.find((c) => c.campo === "vistas" && c.red === "facebook")?.valor).toBe(250);
    expect(f.cifras48h.find((c) => c.campo === "tiempoPromedioS")?.valor).toBe(13.86);
  });

  it("el reel 06: tiempos de varias redes", () => {
    const tiempos = reel("06").cifras48h.filter((c) => c.campo === "tiempoPromedioS");
    expect(tiempos.map((c) => [c.red, c.valor])).toEqual([
      ["tiktok", 16.9],
      ["instagram", 14.5],
      ["facebook", 1.9],
    ]);
    expect(reel("06").cifras48h.find((c) => c.campo === "pctCompleto")).toMatchObject({ red: "tiktok", valor: 9.2 });
  });

  it("04-G4: el entero inicial de las vistas y la red de cada tiempo", () => {
    const f = reel("04-G4");
    expect(f.cifras48h.find((c) => c.campo === "vistas" && c.red === "facebook")?.valor).toBe(204);
    expect(f.cifras48h.find((c) => c.campo === "vistas" && c.red === "tiktok")?.valor).toBe(79);
    const tiempos = f.cifras48h.filter((c) => c.campo === "tiempoPromedioS");
    expect(tiempos.map((c) => [c.red, c.valor])).toEqual([
      ["facebook", 7],
      ["tiktok", 2.96],
    ]);
    expect(f.cifras48h.find((c) => c.campo === "ret3s")).toMatchObject({ red: "facebook", valor: 51 });
  });

  it("02: 15% de FB va a ret3s", () => {
    expect(reel("02").cifras48h.find((c) => c.campo === "ret3s")).toMatchObject({ red: "facebook", valor: 15 });
  });

  it("carpeta: null si no es una carpeta, y acepta _reserva/", () => {
    expect(reel("02").carpeta).toBeNull();
    expect(reel("04-G4").carpeta).toBeNull();
    expect(reel("04C-G6").carpeta).toBe("_reserva/04C-G6_stop-motion_cuerpo-C");
    expect(reel("09").carpeta).toBe("2026-11-05_jue_09_desde-la-casa");
  });

  it("voz, formato y etiqueta de IA", () => {
    expect(reel("10").voz).toBe("fernando");
    expect(reel("15").voz).toBe("sin_voz");
    expect(reel("15").formato).toBe("dialogo");
    expect(reel("04C-G1").voz).toBe("andres");
    expect(reel("04C-G1").vozDetalle).toBe("Andrés (28-oct, 1,12x)");
    expect(reel("06").voz).toBe("otra");
    expect(reel("02").voz).toBeNull();
    expect(reel("02").vozDetalle).toBeNull();
    expect(reel("09").formato).toBe("prueba_real");
    expect(reel("16").formato).toBe("pantalla_dividida");
    expect(reel("17").formato).toBe("la_cuenta");
    expect(reel("TERROR02").formato).toBe("otro");
    expect(reel("04-G4").etiquetaIa).toBeNull();
    expect(reel("04C-G1").etiquetaIa).toBe(false);
    expect(reel("TERROR02").etiquetaIa).toBe(true);
    expect(reel("02").etiquetaIa).toBeNull();
  });

  it("puntaje del guion y duración", () => {
    expect(reel("09").puntajeGuion).toBe(4);
    expect(reel("09b").puntajeGuion).toBe(11);
    expect(reel("14").puntajeGuion).toBe(12);
    expect(reel("02").puntajeGuion).toBeNull();
    expect(reel("TERROR02").duracionS).toBe(95);
    expect(reel("14").duracionS).toBe(30.8);
  });

  it("los avisos son solo lo que no se pudo ubicar", () => {
    expect(avisos).toEqual([
      expect.stringContaining('Reel 04-G4, pct_completo: no se sabe con certeza la red de "6,5% llega a 20 s (FB)"'),
      expect.stringContaining('Reel APP01, link_tiktok: "19:30" no es un enlace'),
    ]);
  });
});

describe("leerSeguimiento con entradas pequeñas", () => {
  const cabecera =
    "fecha,dia,id,carpeta,prueba,cuerpo,gancho,voz,etiqueta_ia,estado,hora_fb_ig,hora_tiktok,link_tiktok,link_instagram,link_facebook,vistas_48h_tiktok,vistas_48h_instagram,vistas_48h_facebook,tiempo_promedio_s,pct_pasa_3s,pct_completo,comentarios_lavado,envios,mensajes,notas";

  it("un número sin red se salta y se avisa", () => {
    const fila = '2026-11-01,sab,99,,Gancho,,"g, con coma",Voice Changer,Sí,publicado,,,,,,,,,7,,,,,,';
    const r = leerSeguimiento(`${cabecera}\n${fila}`);
    expect(r.filas[0]?.cifras48h).toEqual([]);
    expect(r.filas[0]?.voz).toBe("andres_voice_changer");
    expect(r.filas[0]?.gancho).toBe("g, con coma");
    expect(r.avisos).toHaveLength(1);
  });

  it("acepta BOM y salta (con aviso) una fila con fecha inválida", () => {
    expect(leerSeguimiento(`﻿${cabecera}`).filas).toEqual([]);
    const r = leerSeguimiento(`${cabecera}\nmañana,sab,1,,,,,,,,,,,,,,,,,,,,,,`);
    expect(r.filas).toEqual([]);
    expect(r.avisos.some((a) => a.includes("línea 2"))).toBe(true);
  });
});
