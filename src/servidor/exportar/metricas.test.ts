// Exportación de métricas a CSV: función pura filas -> texto, y armado de filas por publicación y fuente.
import { describe, expect, it } from "vitest";
import { COLUMNAS, armarFilasMetricas, aCsv, escaparCelda, type LecturaExport, type PublicacionExport } from "./metricas";

const t = (iso: string) => new Date(iso);

const pub = (id: number, p: Partial<PublicacionExport> = {}): PublicacionExport => ({
  id,
  reelId: "10",
  red: "tiktok",
  cuenta: "@btw",
  estado: "publicado",
  enlace: "https://x.test/1",
  publicadoEn: t("2026-11-01T12:00:00Z"),
  ...p,
});

const lec = (publicacionId: number, p: Partial<LecturaExport>): LecturaExport => ({
  publicacionId,
  fuente: "zernio",
  via: "api",
  leidoEn: t("2026-11-06T10:00:00Z"),
  datoActualizadoEn: t("2026-11-06T09:00:00Z"),
  horasDesdePublicacion: 45,
  vistas: null,
  alcance: null,
  meGusta: null,
  comentarios: null,
  compartidos: null,
  guardados: null,
  tiempoPromedioS: null,
  pctCompleto: null,
  pctSalta3s: null,
  ret3s: null,
  seguidoresGanados: null,
  ...p,
});

describe("escaparCelda", () => {
  it("deja igual el texto simple y vacía el null", () => {
    expect(escaparCelda("hola")).toBe("hola");
    expect(escaparCelda(null)).toBe("");
    expect(escaparCelda(0)).toBe("0");
  });
  it("entrecomilla y duplica comillas con comas, comillas y saltos de línea", () => {
    expect(escaparCelda("a,b")).toBe('"a,b"');
    expect(escaparCelda('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(escaparCelda("uno\ndos")).toBe('"uno\ndos"');
    expect(escaparCelda("uno\r\ndos")).toBe('"uno\r\ndos"');
  });
});

describe("armarFilasMetricas", () => {
  it("una fila por publicación y fuente, con la lectura más reciente de cada una", () => {
    const filas = armarFilasMetricas(
      [pub(1)],
      [
        lec(1, { fuente: "zernio", datoActualizadoEn: t("2026-11-04T00:00:00Z"), vistas: 10 }),
        lec(1, { fuente: "zernio", datoActualizadoEn: t("2026-11-06T00:00:00Z"), vistas: 30 }),
        lec(1, { fuente: "meta", datoActualizadoEn: t("2026-11-05T00:00:00Z"), vistas: 99 }),
      ],
    );
    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.fuente)).toEqual(["meta", "zernio"]);
    expect(filas.find((f) => f.fuente === "zernio")?.vistas).toBe(30);
  });

  it("una publicación sin lecturas sale en una fila con las cifras vacías", () => {
    const filas = armarFilasMetricas([pub(2, { estado: "programado", publicadoEn: null })], []);
    expect(filas).toHaveLength(1);
    expect(filas[0]?.fuente).toBeNull();
    expect(filas[0]?.vistas).toBeNull();
  });
});

describe("aCsv", () => {
  it("encabezado, null vacío (no 0), fechas ISO y escapes", () => {
    const filas = armarFilasMetricas(
      [pub(1, { enlace: 'https://x.test/?a=1,2&b="c"', cuenta: "línea\nnueva" })],
      [lec(1, { vistas: 1234, meGusta: 0, alcance: null })],
    );
    const csv = aCsv(filas);
    const lineas = csv.split("\r\n");
    expect(lineas[0]).toBe(COLUMNAS.join(","));
    expect(csv).toContain("2026-11-01T12:00:00.000Z");
    expect(csv).toContain('"https://x.test/?a=1,2&b=""c"""');
    expect(csv).toContain('"línea\nnueva"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("sin filas sale solo el encabezado", () => {
    expect(aCsv([])).toBe(COLUMNAS.join(",") + "\r\n");
  });

  it("cada fila tiene tantas celdas como el encabezado", () => {
    const filas = armarFilasMetricas([pub(1, { cuenta: "a,b" })], [lec(1, { vistas: 5 })]);
    const celdas = parseCsv(aCsv(filas));
    expect(celdas).toHaveLength(2);
    for (const c of celdas) expect(c).toHaveLength(COLUMNAS.length);
    const fila = celdas[1]!;
    expect(fila[COLUMNAS.indexOf("cuenta")]).toBe("a,b");
    expect(fila[COLUMNAS.indexOf("vistas")]).toBe("5");
    expect(fila[COLUMNAS.indexOf("alcance")]).toBe("");
  });
});

/** Lector mínimo de RFC 4180 para comprobar la salida. */
function parseCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entre = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (entre) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entre = false;
      else celda += c;
    } else if (c === '"') entre = true;
    else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\r" && texto[i + 1] === "\n") {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
      i++;
    } else celda += c;
  }
  return filas;
}
