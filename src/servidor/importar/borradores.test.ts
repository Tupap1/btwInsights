import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { leerBorradoresCsv } from "./borradores";

const RUTA = path.join(process.cwd(), "pruebas/fixtures/btw-videos/publicar/zernio-borradores.csv");
const CABECERA = "id,red,fecha_plan,post_id,estado,creado";

function csv(...filas: string[]): string {
  return [CABECERA, ...filas].join("\n") + "\n";
}

describe("leerBorradoresCsv", () => {
  it("lee zernio-borradores.csv real: 20 filas (10 TikTok y 10 Instagram)", () => {
    const filas = leerBorradoresCsv(readFileSync(RUTA, "utf8"));
    expect(filas).toHaveLength(20);
    expect(filas.filter((f) => f.red === "tiktok")).toHaveLength(10);
    expect(filas.filter((f) => f.red === "instagram")).toHaveLength(10);
  });

  it("pone post_id en zernioPostId para TikTok e Instagram, y no en postIdPlataforma", () => {
    const [primera] = leerBorradoresCsv(readFileSync(RUTA, "utf8"));
    expect(primera).toEqual({
      reelId: "14",
      red: "tiktok",
      fechaPlan: "2026-11-06",
      zernioPostId: "6aed0f09c8b8b16a7925d002",
      postIdPlataforma: null,
      estado: "draft",
      creadoEn: new Date("2026-11-05T23:19:37.473Z"),
    });
  });

  it("en Facebook, post_id va a postIdPlataforma", () => {
    const [fila] = leerBorradoresCsv(
      csv("11,facebook,2026-11-08,1234567890_987,draft,2026-11-06T02:13:33.391Z"),
    );
    expect(fila?.red).toBe("facebook");
    expect(fila?.zernioPostId).toBeNull();
    expect(fila?.postIdPlataforma).toBe("1234567890_987");
  });

  it("un post_id vacío queda en null", () => {
    const [fila] = leerBorradoresCsv(csv("14,tiktok,2026-11-06,,draft,2026-11-06T02:13:33.391Z"));
    expect(fila?.zernioPostId).toBeNull();
    expect(fila?.postIdPlataforma).toBeNull();
  });

  it("acepta un BOM al inicio del archivo", () => {
    const filas = leerBorradoresCsv(`﻿${csv("14,tiktok,2026-11-06,abc,draft,2026-11-06T02:13:33.391Z")}`);
    expect(filas).toHaveLength(1);
    expect(filas[0]?.reelId).toBe("14");
  });

  it("ignora las líneas vacías", () => {
    const filas = leerBorradoresCsv(
      csv("14,tiktok,2026-11-06,abc,draft,2026-11-06T02:13:33.391Z", "", "15,tiktok,2026-11-09,def,draft,2026-11-06T02:13:33.391Z"),
    );
    expect(filas.map((f) => f.reelId)).toEqual(["14", "15"]);
  });

  it("sin filas devuelve una lista vacía", () => {
    expect(leerBorradoresCsv(CABECERA + "\n")).toEqual([]);
  });

  it("una fila con red desconocida lanza error con el número de fila", () => {
    const texto = csv(
      "14,tiktok,2026-11-06,abc,draft,2026-11-06T02:13:33.391Z",
      "15,youtube,2026-11-09,def,draft,2026-11-06T02:13:33.391Z",
    );
    expect(() => leerBorradoresCsv(texto)).toThrow(/fila 3/);
  });

  it("una fecha mal formada lanza error con el número de fila", () => {
    expect(() => leerBorradoresCsv(csv("14,tiktok,06/11/2026,abc,draft,2026-11-06T02:13:33.391Z"))).toThrow(/fila 2/);
  });

  it("una fecha de creación inválida lanza error", () => {
    expect(() => leerBorradoresCsv(csv("14,tiktok,2026-11-06,abc,draft,no-es-fecha"))).toThrow(/creado/);
  });

  it("una fila sin id lanza error", () => {
    expect(() => leerBorradoresCsv(csv(",tiktok,2026-11-06,abc,draft,2026-11-06T02:13:33.391Z"))).toThrow(/fila 2/);
  });
});
