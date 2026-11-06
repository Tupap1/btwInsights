import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { leerTextoTxt } from "./texto";

const RAIZ = path.join(process.cwd(), "pruebas/fixtures/btw-videos/publicar");

function textosReales(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = path.join(dir, entrada);
    if (statSync(ruta).isDirectory()) return textosReales(ruta);
    return entrada === "texto.txt" ? [ruta] : [];
  });
}

function leerFixture(ruta: string): string {
  return readFileSync(ruta, "utf8");
}

function fixture(carpeta: string): string {
  return leerFixture(path.join(RAIZ, carpeta, "texto.txt"));
}

describe("leerTextoTxt con los fixtures reales", () => {
  const rutas = textosReales(RAIZ);

  it("encuentra los texto.txt, incluidos los de _reserva", () => {
    expect(rutas.length).toBe(28);
    expect(rutas.filter((r) => r.includes("_reserva")).length).toBe(10);
  });

  it("lee todos sin lanzar y sin dejar CR ni BOM en el resultado", () => {
    for (const ruta of rutas) {
      const texto = leerTextoTxt(leerFixture(ruta));
      const valores = [texto.tiktok, texto.meta, texto.general, texto.comentarioFijado, texto.unArchivo, ...texto.avisos];
      for (const valor of valores) {
        if (valor === null) continue;
        expect(valor, ruta).not.toMatch(/\r/);
        expect(valor, ruta).not.toMatch(/^﻿/);
        expect(valor, ruta).toBe(valor.trim());
      }
    }
  });

  it("archivo con encabezados TIKTOK y FACEBOOK E INSTAGRAM separa las dos redes y los avisos", () => {
    const texto = leerTextoTxt(fixture("2026-11-05_jue_09_desde-la-casa"));
    expect(texto.tiktok).toMatch(/^Así controlas tu lavadero/);
    expect(texto.tiktok).not.toMatch(/FACEBOOK/);
    expect(texto.meta).toMatch(/^Así controlas tu lavadero/);
    expect(texto.meta).toContain("¿Quieres probarlo en tu lavadero?");
    expect(texto.general).toBeNull();
    expect(texto.comentarioFijado).toBeNull();
    expect(texto.unArchivo).toBeNull();
    expect(texto.avisos).toEqual([
      "Permiso por escrito del cliente para usar el video de sus cámaras.",
      'Etiqueta de IA en las tres redes (TikTok: "Contenido generado por IA"; Meta: "Información sobre IA").',
      "Ubicación: la ciudad, no un local.",
      'Comentario fijado: "¿Tu lavadero lo llevas en cuaderno, en Excel o en una app?"',
    ]);
  });

  it("archivo con UN SOLO ARCHIVO, TEXTO, COMENTARIO FIJADO y ANTES DE PUBLICAR", () => {
    const texto = leerTextoTxt(fixture("2026-11-06_vie_10_cuantos-carros"));
    expect(texto.unArchivo).toMatch(/^El cierre es una pregunta de verdad/);
    expect(texto.general).toMatch(/^Montaste tu lavadero con \$20 millones\./);
    expect(texto.general).toContain("Cifras de ejemplo.");
    expect(texto.general).not.toContain("COMENTARIO FIJADO");
    expect(texto.comentarioFijado).toMatch(/^Haz la cuenta con tus propios números/);
    expect(texto.tiktok).toBeNull();
    expect(texto.meta).toBeNull();
    expect(texto.avisos.length).toBeGreaterThan(0);
    expect(texto.avisos.every((aviso) => !aviso.startsWith("- "))).toBe(true);
  });

  it("archivo viejo sin encabezados (2026-10-29) va entero a general", () => {
    const contenido = fixture("2026-10-29_jue_04C-G1_cuanto-te-quedo_cuerpo-C");
    const texto = leerTextoTxt(contenido);
    expect(texto.general).toBe(contenido.replace(/\r\n/g, "\n").trim());
    expect(texto.tiktok).toBeNull();
    expect(texto.meta).toBeNull();
    expect(texto.comentarioFijado).toBeNull();
    expect(texto.avisos).toEqual([]);
  });

  it("archivo con fin de línea CRLF (2026-11-02) se lee igual que con LF", () => {
    const crlf = fixture("2026-11-02_lun_APP01_app-real_cuerpo-app");
    expect(crlf).toContain("\r\n");
    const texto = leerTextoTxt(crlf);
    expect(texto.general).not.toBeNull();
    expect(texto.general).not.toMatch(/\r/);
    expect(leerTextoTxt(crlf.replace(/\r\n/g, "\n"))).toEqual(texto);
  });

  it("los textos de _reserva no tienen encabezados de TIKTOK ni de Meta: todo va a general", () => {
    for (const ruta of rutas.filter((r) => r.includes("_reserva"))) {
      const texto = leerTextoTxt(leerFixture(ruta));
      expect(texto.general, ruta).not.toBeNull();
      expect(texto.tiktok, ruta).toBeNull();
      expect(texto.meta, ruta).toBeNull();
    }
  });
});

describe("leerTextoTxt con casos borde", () => {
  it("quita el BOM al inicio", () => {
    const texto = leerTextoTxt("﻿TEXTO\nHola mundo\n");
    expect(texto.general).toBe("Hola mundo");
  });

  it("un archivo sin ningún encabezado va a general, con BOM incluido", () => {
    const texto = leerTextoTxt("﻿Solo texto suelto.\n\nOtra línea.");
    expect(texto.general).toBe("Solo texto suelto.\n\nOtra línea.");
  });

  it("un archivo vacío deja todo en null y avisos vacíos", () => {
    expect(leerTextoTxt("")).toEqual({
      tiktok: null,
      meta: null,
      general: null,
      comentarioFijado: null,
      avisos: [],
      unArchivo: null,
    });
  });

  it("una sección sin texto queda en null", () => {
    const texto = leerTextoTxt("COMENTARIO FIJADO\n\nTEXTO\nHola\n");
    expect(texto.comentarioFijado).toBeNull();
    expect(texto.general).toBe("Hola");
  });

  it("TEXTO solo cuenta si la línea es exactamente TEXTO", () => {
    const texto = leerTextoTxt("TEXTO   \nHola\nTEXTO extra no es encabezado\nMás\n");
    expect(texto.general).toBe("Hola\nTEXTO extra no es encabezado\nMás");
  });

  it("en ANTES DE PUBLICAR solo sale lo que empieza con '- ', sin el guion", () => {
    const texto = leerTextoTxt("ANTES DE PUBLICAR\n- Uno\nnota suelta\n-  Dos  \n-\n");
    expect(texto.avisos).toEqual(["Uno", "Dos"]);
  });

  it("separa TIKTOK y FACEBOOK E INSTAGRAM aunque vengan en orden inverso", () => {
    const texto = leerTextoTxt(
      "FACEBOOK E INSTAGRAM (a.mp4)\nTexto meta\n\nTIKTOK (b.mp4)\nTexto tiktok\n",
    );
    expect(texto.meta).toBe("Texto meta");
    expect(texto.tiktok).toBe("Texto tiktok");
  });

  it("captura el encabezado UN SOLO ARCHIVO en unArchivo", () => {
    const texto = leerTextoTxt("UN SOLO ARCHIVO PARA LAS TRES REDES (x.mp4)\nNota\n\nTEXTO\nHola\n");
    expect(texto.unArchivo).toBe("Nota");
    expect(texto.general).toBe("Hola");
  });
});
