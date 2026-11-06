import { describe, expect, it } from "vitest";
import { separarAlertas } from "./hoy";

const a = (id: number, clave: string, nivel: "info" | "aviso" | "error" = "aviso") => ({
  id,
  clave,
  nivel,
  mensaje: `m${id}`,
  creadaEn: new Date("2026-11-06T06:00:00Z"),
});

describe("separarAlertas", () => {
  it("los días sin video y los dobles van a calendario; lo demás es urgente", () => {
    const r = separarAlertas([
      a(1, "cola:2026-11-07:facebook:sin-video"),
      a(2, "lectura:atrasada", "error"),
      a(3, "cola:2026-11-08:tiktok:doble"),
      a(4, "cola:14:sin-programar"),
      a(5, "meta:token", "error"),
      a(6, "cola:22:ia-sin-etiqueta"),
    ]);
    expect(r.urgentes.map((x) => x.id)).toEqual([2, 5, 4, 6]);
    expect(r.calendario.map((x) => x.id)).toEqual([1, 3]);
  });

  it("dentro de urgentes, los errores van primero sin cambiar el orden entre iguales", () => {
    const r = separarAlertas([a(1, "cola:9:fallida", "aviso"), a(2, "meta:token", "error"), a(3, "x", "info")]);
    expect(r.urgentes.map((x) => x.id)).toEqual([2, 1, 3]);
  });

  it("sin alertas, las dos listas quedan vacías", () => {
    expect(separarAlertas([])).toEqual({ urgentes: [], calendario: [] });
  });
});
