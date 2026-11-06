// La hora de las lecturas de métricas CSV sale de la fecha de modificación del archivo. Al copiar btw-videos (tar,
// zip, otra máquina) esa fecha pierde los milisegundos: re-importar no debe duplicar lecturas por eso (6-nov:
// producción sumó 19 lecturas repetidas de Meta que solo diferían en 0,725 s).
import { cpSync, mkdtempSync, readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { lectura } from "../db/esquema";
import { importar } from "./a-la-base";

describe.skipIf(!hayBd)("importar: hora del archivo de métricas", () => {
  const db = bd();
  const dir = mkdtempSync(join(tmpdir(), "btw-videos-"));
  const carpeta = join(dir, "publicar", "metricas");
  const csvs = () => readdirSync(carpeta).filter((x) => /^\d{4}-\d{2}-\d{2}\.csv$/.test(x));
  const ponerHora = (t: Date) => {
    for (const n of csvs()) utimesSync(join(carpeta, n), t, t);
  };
  const lecturasCsv = async () => {
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(lectura).where(eq(lectura.via, "csv"));
    return n;
  };
  const HORA = new Date("2026-11-05T23:03:30.725Z");
  let tras: number[] = [];

  beforeAll(async () => {
    cpSync("pruebas/fixtures/btw-videos", dir, { recursive: true });
    await vaciar(db);
    ponerHora(HORA); // con milisegundos, como en el PC de Andrés
    await importar(db, dir);
    const a = await lecturasCsv();
    ponerHora(new Date(Math.floor(HORA.getTime() / 1000) * 1000)); // la misma carpeta copiada con tar
    await importar(db, dir);
    const b = await lecturasCsv();
    ponerHora(new Date(HORA.getTime() + 3 * 3_600_000)); // el archivo cambió de verdad, horas después
    await importar(db, dir);
    const c = await lecturasCsv();
    tras = [a, b, c];
  });
  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    await cerrarBd();
  });

  it("ninguna lectura guarda los milisegundos de la hora del archivo", async () => {
    const filas = await db.select({ t: lectura.datoActualizadoEn }).from(lectura).where(eq(lectura.via, "csv"));
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.some((f) => f.t.getTime() % 1000 === 725)).toBe(false);
  });

  it("re-importar la misma carpeta con la hora sin milisegundos no agrega lecturas", () => {
    expect(tras[0]).toBeGreaterThan(0);
    expect(tras[1]).toBe(tras[0]);
  });

  it("un archivo modificado horas después sí agrega las lecturas que toman su hora", () => {
    expect(tras[2]).toBeGreaterThan(tras[1] ?? 0);
  });
});
