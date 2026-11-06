import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { comentario, hiloComentarios, publicacion, reel } from "../db/esquema";
import { comentariosDeReel, consultarComentarios, contarSinResponder, leerVer } from "./comentarios";
import { consultarHoy } from "./hoy";

const AHORA = new Date("2026-11-07T12:00:00Z");

describe("leerVer", () => {
  it("'todos' solo con ?ver=todos; todo lo demás es 'Sin responder'", () => {
    expect(leerVer("todos")).toBe("todos");
    expect(leerVer(undefined)).toBe("sin_responder");
    expect(leerVer("otra")).toBe("sin_responder");
    expect(leerVer(["todos"])).toBe("sin_responder");
  });
});

describe.skipIf(!hayBd)("consultas de comentarios", { timeout: 60_000 }, () => {
  const db = bd();
  let pubIg = 0;
  let pubTt = 0;
  let n = 0;

  /** Inserta un comentario con valores por defecto de "otra persona, primer nivel". */
  const poner = async (
    publicacionId: number,
    id: string,
    extra: Partial<typeof comentario.$inferInsert> = {},
  ): Promise<void> => {
    n += 1;
    await db.insert(comentario).values({
      publicacionId,
      red: publicacionId === pubIg ? "instagram" : "tiktok",
      idPlataforma: id,
      texto: `texto ${id}`,
      autorUsuario: `usuario_${id}`,
      esPropio: false,
      respuestas: 0,
      creadoEn: new Date(AHORA.getTime() - n * 3_600_000),
      ...extra,
    });
  };

  beforeEach(async () => {
    await vaciar(db);
    n = 0;
    await db.insert(reel).values({ id: "13" });
    const pubs = await db
      .insert(publicacion)
      .values([
        { red: "instagram", reelId: "13", postIdPlataforma: "pi", estado: "publicado", origen: "zernio", enlace: "https://ig/pub" },
        { red: "tiktok", reelId: "13", postIdPlataforma: "pt", estado: "publicado", origen: "zernio" },
      ])
      .returning({ id: publicacion.id });
    pubIg = pubs[0]?.id ?? 0;
    pubTt = pubs[1]?.id ?? 0;
  });
  afterAll(cerrarBd);

  it("sin hilos leídos: la tarjeta de /hoy es null (no 0) y la pantalla no tiene fecha de lectura", async () => {
    expect(await contarSinResponder(db)).toBeNull();
    expect((await consultarHoy(db, AHORA)).comentariosSinResponder).toBeNull();
    const v = await consultarComentarios(db, "sin_responder");
    expect(v).toMatchObject({ comentarios: [], sinResponder: 0, total: 0, ultimaLectura: null });
  });

  it("con hilos leídos y nada sin responder: 0", async () => {
    await db.insert(hiloComentarios).values({ publicacionId: pubIg, conteoFuente: 0, completo: true, leidoEn: AHORA });
    expect(await contarSinResponder(db)).toBe(0);
    expect((await consultarHoy(db, AHORA)).comentariosSinResponder).toBe(0);
  });

  describe("con datos", () => {
    beforeEach(async () => {
      await db.insert(hiloComentarios).values([
        { publicacionId: pubIg, conteoFuente: 5, completo: true, leidoEn: new Date(AHORA.getTime() - 3_600_000) },
        { publicacionId: pubTt, conteoFuente: 1, completo: true, leidoEn: new Date(AHORA.getTime() - 7_200_000) },
      ]);
      await poner(pubIg, "sin", { respuestas: 0 }); // sin responder
      await poner(pubIg, "resp", { respuestas: 1 }); // respondido
      await poner(pubIg, "resp1", { padreIdPlataforma: "resp", respuestas: null, esPropio: true });
      await poner(pubIg, "duda", { respuestas: 2 }); // faltan respuestas: null
      await poner(pubIg, "propio", { esPropio: true }); // de la cuenta: no sale
      await poner(pubIg, "fuera", { desaparecioEn: AHORA }); // desapareció: no sale
      await poner(pubTt, "tt", { respuestas: 0, enlace: "https://tt/c" });
    });

    it("'Sin responder' trae solo respondido === false, del más nuevo al más viejo", async () => {
      const v = await consultarComentarios(db, "sin_responder");
      expect(v.comentarios.map((c) => c.texto)).toEqual(["texto sin", "texto tt"]);
      expect(v.sinResponder).toBe(2);
      expect(v.total).toBe(4);
    });

    it("'Todos' trae los de otras personas que no desaparecieron, con su estado", async () => {
      const v = await consultarComentarios(db, "todos");
      expect(v.comentarios.map((c) => [c.texto, c.respondido])).toEqual([
        ["texto sin", false],
        ["texto resp", true],
        ["texto duda", null],
        ["texto tt", false],
      ]);
    });

    it("lleva @, red, reel y el enlace del comentario o, si no hay, el de la publicación", async () => {
      const v = await consultarComentarios(db, "todos");
      const sin = v.comentarios.find((c) => c.texto === "texto sin");
      expect(sin).toMatchObject({ autorUsuario: "usuario_sin", red: "instagram", reelId: "13", enlace: "https://ig/pub" });
      expect(v.comentarios.find((c) => c.texto === "texto tt")?.enlace).toBe("https://tt/c");
    });

    it("la fecha de lectura es la más reciente de hilo_comentarios", async () => {
      const v = await consultarComentarios(db, "todos");
      expect(v.ultimaLectura?.toISOString()).toBe(new Date(AHORA.getTime() - 3_600_000).toISOString());
    });

    it("la tarjeta de /hoy cuenta los sin responder", async () => {
      expect(await contarSinResponder(db)).toBe(2);
      expect((await consultarHoy(db, AHORA)).comentariosSinResponder).toBe(2);
    });

    it("el detalle de un reel junta sus publicaciones; otro reel no trae nada", async () => {
      expect((await comentariosDeReel(db, "13")).map((c) => c.texto)).toEqual(["texto sin", "texto resp", "texto duda", "texto tt"]);
      expect(await comentariosDeReel(db, "99")).toEqual([]);
    });
  });
});
