import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buscarEn, leerValores } from "./revisar-secretos.mjs";

// Todos los valores de estas pruebas son falsos y se escriben en un directorio temporal.

let raiz: string;

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), "revisar-secretos-prueba-"));
});

afterEach(() => {
  rmSync(raiz, { recursive: true, force: true });
});

describe("leerValores", () => {
  it("toma solo las variables listadas, quita comillas y saca la contraseña de DATABASE_URL", () => {
    const texto = [
      "META_PAGE_TOKEN=\"tokenfalso-meta-1\"",
      "ZERNIO_API_KEY='llavefalsa-zernio'",
      "POSTGRES_PASSWORD=claveBD-falsa-01",
      "DATABASE_URL=postgres://usuario:passfalsa-url-99@127.0.0.1:5434/btw",
      "OTRA_VARIABLE=no-listada-valor",
    ].join("\n");

    expect(leerValores(texto)).toEqual({
      META_PAGE_TOKEN: "tokenfalso-meta-1",
      ZERNIO_API_KEY: "llavefalsa-zernio",
      POSTGRES_PASSWORD: "claveBD-falsa-01",
      DATABASE_URL: "passfalsa-url-99",
    });
  });

  it("ignora los valores de menos de 8 caracteres y las líneas vacías", () => {
    const texto = ["RECOLECTOR_SECRETO=corta", "POSTGRES_APP_PASSWORD=", "POSTGRES_LECTURA_PASSWORD=\"siete77\""].join(
      "\n",
    );

    expect(leerValores(texto)).toEqual({});
  });

  it("ignora los comentarios aunque nombren una variable listada", () => {
    const texto = ["# ZERNIO_API_KEY=comentada-valor-larga", "  # POSTGRES_PASSWORD=otra-comentada-larga"].join("\n");

    expect(leerValores(texto)).toEqual({});
  });
});

describe("buscarEn", () => {
  const valor = "valorfalso-escondido-42";

  it("encuentra el valor en un archivo de texto y en uno binario, y omite cache/", () => {
    mkdirSync(join(raiz, "server"));
    mkdirSync(join(raiz, "cache"));
    writeFileSync(join(raiz, "server", "app.js"), `const x = "${valor}";\n`);
    writeFileSync(
      join(raiz, "server", "chunk.bin"),
      Buffer.concat([Buffer.from([0, 1, 2, 255]), Buffer.from(valor), Buffer.from([0, 9])]),
    );
    writeFileSync(join(raiz, "cache", "viejo.txt"), `restos ${valor}`);

    const hallazgos = buscarEn(raiz, { POSTGRES_PASSWORD: valor });

    expect(hallazgos).toHaveLength(2);
    expect(hallazgos).toEqual(
      expect.arrayContaining([
        { variable: "POSTGRES_PASSWORD", archivo: "server/app.js" },
        { variable: "POSTGRES_PASSWORD", archivo: "server/chunk.bin" },
      ]),
    );
  });

  it("el resultado serializado no contiene el valor", () => {
    writeFileSync(join(raiz, "app.js"), `const x = "${valor}";`);

    const hallazgos = buscarEn(raiz, { ZERNIO_API_KEY: valor });
    const serializado = JSON.stringify(hallazgos);

    expect(hallazgos).toHaveLength(1);
    expect(serializado).not.toContain(valor);
    expect(serializado).not.toContain(valor.slice(0, 10));
  });

  it("devuelve [] si ningún archivo tiene valores", () => {
    mkdirSync(join(raiz, "static"));
    writeFileSync(join(raiz, "static", "limpio.js"), "console.log('hola');");

    expect(buscarEn(raiz, { META_PAGE_TOKEN: valor })).toEqual([]);
  });
});
