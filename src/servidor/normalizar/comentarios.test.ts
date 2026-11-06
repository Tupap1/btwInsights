import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filasDeLista, normalizarHilo } from "./comentarios";

const fixture = (nombre: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(process.cwd(), "pruebas/fixtures/api", `${nombre}.json`), "utf8")) as Record<string, unknown>;

const comentariosDe = (nombre: string): unknown[] => fixture(nombre)["comments"] as unknown[];

/** Un comentario de otra persona, con la misma forma que manda Zernio (nombres de prueba). */
const deOtro = (id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  message: "¿Cuánto cuesta?",
  createdTime: "2026-11-06T10:00:00+0000",
  from: { id: "999-secreto", name: "Persona de Prueba", username: "persona_prueba", picture: "https://x/foto.jpg", isOwner: false },
  likeCount: 2,
  replyCount: 1,
  platform: "instagram",
  url: "https://www.instagram.com/reel/AAA/?comment_id=" + id,
  replies: [],
  isHidden: false,
  ...extra,
});

describe("filasDeLista", () => {
  it("lee las 17 filas reales y marca las 5 con comentarios", () => {
    const { filas, descartadas } = filasDeLista(fixture("zernio-inbox-comments")["data"] as unknown[]);
    expect(descartadas).toBe(0);
    expect(filas).toHaveLength(17);
    expect(filas.filter((f) => f.conteo !== null && f.conteo > 0)).toHaveLength(5);
    const ig = filas.find((f) => f.postId === "18120342799999707");
    expect(ig).toMatchObject({ red: "instagram", cuentaId: "6aed36858405bb702db92cda", conteo: 1 });
    expect(ig?.creadoEn?.toISOString()).toBe("2026-11-05T18:39:26.000Z");
  });

  it("ignora las filas de pauta (isAd) y cuenta como descartadas las que no se entienden", () => {
    const base = { id: "1", accountId: "a", platform: "instagram", commentCount: 3, createdTime: "2026-11-05T18:39:26.000Z" };
    const { filas, descartadas } = filasDeLista([
      base,
      { ...base, id: "2", isAd: true },
      { ...base, id: "3", platform: "youtube" },
      { accountId: "a" },
      "basura",
    ]);
    expect(filas.map((f) => f.postId)).toEqual(["1"]);
    expect(descartadas).toBe(3);
  });

  it("un commentCount que no es número queda en null, no en 0", () => {
    const { filas } = filasDeLista([{ id: "1", accountId: "a", platform: "tiktok" }]);
    expect(filas[0]?.conteo).toBeNull();
  });
});

describe("normalizarHilo", () => {
  it("Instagram: lee la fecha con +0000 sin dos puntos", () => {
    const { comentarios, descartados } = normalizarHilo(comentariosDe("zernio-inbox-hilo-instagram"));
    expect(descartados).toBe(0);
    expect(comentarios).toHaveLength(1);
    expect(comentarios[0]).toMatchObject({
      idPlataforma: "18212936308364837",
      padreIdPlataforma: null,
      autorUsuario: "btwone.co",
      esPropio: true,
      meGusta: 0,
      respuestas: 0,
      oculto: false,
    });
    expect(comentarios[0]?.creadoEn?.toISOString()).toBe("2026-11-05T18:41:29.000Z");
    expect(comentarios[0]?.enlace).toContain("comment_id=18212936308364837");
  });

  it("TikTok: lee la fecha con Z y la url null queda en null", () => {
    const { comentarios } = normalizarHilo(comentariosDe("zernio-inbox-hilo-tiktok"));
    expect(comentarios[0]?.creadoEn?.toISOString()).toBe("2026-11-05T18:39:40.000Z");
    expect(comentarios[0]?.enlace).toBeNull();
    expect(comentarios[0]?.autorUsuario).toBe("btw.inc");
  });

  it("en la salida no queda nombre, foto ni id de persona", () => {
    for (const nombre of ["zernio-inbox-hilo-instagram", "zernio-inbox-hilo-tiktok"]) {
      const crudo = comentariosDe(nombre);
      const { comentarios } = normalizarHilo(crudo);
      const salida = JSON.stringify(comentarios);
      const from = (crudo[0] as { from: { id: string; name: string } }).from;
      expect(salida).not.toContain(from.id);
      expect(salida).not.toContain(from.name === (crudo[0] as { from: { username: string } }).from.username ? "\u0000" : from.name);
      expect(salida).not.toContain("picture");
      for (const c of comentarios) {
        expect(Object.keys(c).sort()).toEqual(
          ["autorUsuario", "creadoEn", "enlace", "esPropio", "idPlataforma", "meGusta", "oculto", "padreIdPlataforma", "respuestas", "texto"].sort(),
        );
      }
    }
  });

  it("con comentarios de otras personas tampoco queda su nombre, foto ni id", () => {
    const { comentarios } = normalizarHilo([deOtro("c1")]);
    const salida = JSON.stringify(comentarios);
    expect(salida).not.toContain("Persona de Prueba");
    expect(salida).not.toContain("999-secreto");
    expect(salida).not.toContain("foto.jpg");
    expect(comentarios[0]?.autorUsuario).toBe("persona_prueba");
    expect(comentarios[0]?.esPropio).toBe(false);
  });

  it("aplana las respuestas con su padre, también las anidadas", () => {
    const hilo = [
      deOtro("c1", {
        replies: [
          deOtro("c1a", { parentId: "c1", replyCount: 0, replies: [deOtro("c1a1", { replyCount: 0 })] }),
          deOtro("c1b", { replyCount: 0 }),
        ],
      }),
      deOtro("c2", { replyCount: 0 }),
    ];
    const { comentarios } = normalizarHilo(hilo);
    expect(comentarios.map((c) => [c.idPlataforma, c.padreIdPlataforma])).toEqual([
      ["c1", null],
      ["c1a", "c1"],
      ["c1a1", "c1a"],
      ["c1b", "c1"],
      ["c2", null],
    ]);
  });

  it("no repite un comentario que viene dos veces", () => {
    const { comentarios } = normalizarHilo([deOtro("c1", { replies: [deOtro("c9", { parentId: "c1" })] }), deOtro("c9")]);
    expect(comentarios.filter((c) => c.idPlataforma === "c9")).toHaveLength(1);
    expect(comentarios.find((c) => c.idPlataforma === "c9")?.padreIdPlataforma).toBe("c1");
  });

  it("comentario solo imagen: texto vacío; sin usuario: null; sin dato de me gusta: null (no 0)", () => {
    const { comentarios } = normalizarHilo([{ id: "c1", message: null, createdTime: "2026-11-06T10:00:00.000Z", from: { isOwner: false } }]);
    expect(comentarios[0]).toMatchObject({ texto: "", autorUsuario: null, meGusta: null, respuestas: null, creadoEn: expect.any(Date) });
  });

  it("cuenta los que no se entienden (sin id) y sigue con los demás", () => {
    const { comentarios, descartados } = normalizarHilo([deOtro("c1"), { message: "sin id" }, 7]);
    expect(comentarios).toHaveLength(1);
    expect(descartados).toBe(2);
  });
});
