// La acción de /cola no hace nada mientras la edición esté apagada (T24), ni siquiera el paso "revisar".
import { describe, expect, it } from "vitest";
import { editarBorrador } from "./acciones";

function datos(paso: "revisar" | "guardar"): FormData {
  const f = new FormData();
  f.set("paso", paso);
  f.set("confirmar", "si");
  f.set("publicacionId", "1");
  f.set("texto", "Texto nuevo");
  f.set("dia", "2026-11-08");
  f.set("hora", "19:30");
  return f;
}

describe("editarBorrador con la edición apagada", () => {
  it.each(["revisar", "guardar"] as const)("paso %s: responde que está apagada y no toca nada", async (paso) => {
    delete process.env.EDITAR_BORRADORES;
    const r = await editarBorrador(null, datos(paso));
    expect(r).toEqual({ paso: "error", mensaje: expect.stringMatching(/apagada/i) });
  });
});
