import { describe, expect, it } from "vitest";
import { emparejarLote, type ContextoEmparejar } from "./emparejar";
import type { PublicacionVista } from "./tipos";

const texto = '¿Cuánto te quedó hoy? Si la respuesta es "déjame sumo el cuaderno"';
const post = (id: string, iso: string): PublicacionVista => ({
  red: "tiktok",
  origen: "zernio",
  cuenta: null,
  postIdPlataforma: id,
  zernioPostId: null,
  etiquetas: [],
  enlace: null,
  texto,
  duracionS: null,
  programadoPara: null,
  publicadoEn: new Date(iso),
  estado: "publicado",
});

// Caso real (recolector, 5-nov): el post del 29-oct ya está en el 04C-G1 por id; el del 28-oct (que es del 04-G4)
// no puede caer en el 04C-G1 por fecha y texto.
describe("emparejarLote con un reel ya ocupado por id", () => {
  const ctx: ContextoEmparejar = {
    porZernioId: new Map(),
    porPostId: new Map([["tiktok:del-29", "04C-G1"]]),
    reels: [{ id: "04C-G1", fechas: ["2026-10-29"], textos: [texto], duracionesS: [] }],
  };

  it("el del 28 queda sin asignar", () => {
    const [a, b] = emparejarLote([post("del-29", "2026-10-29T06:12:00Z"), post("del-28", "2026-10-28T14:25:00Z")], ctx);
    expect(a).toEqual({ reelId: "04C-G1", por: "id" });
    expect(b?.reelId).toBeNull();
  });
});
