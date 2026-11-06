import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { alerta, comentario, hiloComentarios, publicacion } from "../db/esquema";
import { ErrorFuente } from "../fuentes/http";
import type { ClienteZernio } from "../fuentes/zernio";
import { leerComentarios } from "./comentarios";
import { recolectar } from "./recolectar";

const AHORA = new Date("2026-11-07T12:00:00Z");
const HORA = 3_600_000;
const POST_IG = "18120342799999707";
const POST_TT = "7704758213807312180";

const fixture = (nombre: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(process.cwd(), "pruebas/fixtures/api", `${nombre}.json`), "utf8")) as Record<string, unknown>;
const lista = (): unknown[] => fixture("zernio-inbox-comments")["data"] as unknown[];
const hiloIg = (): unknown[] => fixture("zernio-inbox-hilo-instagram")["comments"] as unknown[];
const hiloTt = (): unknown[] => fixture("zernio-inbox-hilo-tiktok")["comments"] as unknown[];

/** Un comentario de otra persona, con la forma real (nombres de prueba). */
const deOtro = (id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  message: "¿Cuánto cuesta?",
  createdTime: "2026-11-06T10:00:00+0000",
  from: { id: "999-secreto", name: "Persona de Prueba", username: "persona_prueba", picture: null, isOwner: false },
  likeCount: 0,
  replyCount: 0,
  isHidden: false,
  url: `https://www.instagram.com/reel/AAA/?comment_id=${id}`,
  replies: [],
  ...extra,
});

interface Guion {
  lista?: unknown[];
  hilos: Record<string, { comentarios: unknown[]; completo?: boolean } | Error>;
}

/** Cliente falso: solo responde lo del guion. Cuenta cuántos hilos pidió. */
function clienteFalso(g: Guion) {
  const pedidos: string[] = [];
  const cliente: ClienteZernio = {
    cuentas: async () => [],
    analitica: async () => [],
    posts: async () => [],
    post: async () => ({}),
    historial: async () => ({}),
    seguidores: async () => ({ accounts: [] }),
    postsConComentarios: async () => g.lista ?? lista(),
    comentariosDePost: async (postId) => {
      pedidos.push(postId);
      const h = g.hilos[postId];
      if (h === undefined) throw new Error(`hilo sin guion: ${postId}`);
      if (h instanceof Error) throw h;
      return { comentarios: h.comentarios, completo: h.completo ?? true };
    },
    campanasPauta: async () => [],
    anunciosPauta: async () => [],
  };
  return { cliente, pedidos };
}

const hilosReales = (): Guion["hilos"] => ({
  [POST_IG]: { comentarios: hiloIg() },
  [POST_TT]: { comentarios: hiloTt() },
});

describe.skipIf(!hayBd)("recolector: comentarios", { timeout: 60_000 }, () => {
  const db = bd();
  let idIg = 0;
  let idTt = 0;

  beforeEach(async () => {
    await vaciar(db);
    const pubs = await db
      .insert(publicacion)
      .values([
        { red: "instagram", postIdPlataforma: POST_IG, estado: "publicado", origen: "zernio" },
        { red: "tiktok", postIdPlataforma: POST_TT, estado: "publicado", origen: "zernio" },
      ])
      .returning({ id: publicacion.id });
    idIg = pubs[0]?.id ?? 0;
    idTt = pubs[1]?.id ?? 0;
  });
  afterAll(cerrarBd);

  const leer = (c: ClienteZernio, ahora = AHORA) => leerComentarios(db, c, ahora);

  it("inserta los comentarios reales, une cada uno con su publicación y guarda solo el @", async () => {
    const { cliente } = clienteFalso({ hilos: hilosReales() });
    const r = await leer(cliente);
    expect(r).toMatchObject({ comentariosNuevos: 2, hilosLeidos: 2, errores: [] });
    const filas = await db.select().from(comentario);
    expect(filas).toHaveLength(2);
    const ig = filas.find((f) => f.red === "instagram");
    expect(ig).toMatchObject({
      publicacionId: idIg,
      idPlataforma: "18212936308364837",
      padreIdPlataforma: null,
      autorUsuario: "btwone.co",
      esPropio: true,
      desaparecioEn: null,
    });
    expect(ig?.leidoEn.toISOString()).toBe(AHORA.toISOString());
    expect(filas.find((f) => f.red === "tiktok")?.publicacionId).toBe(idTt);
    const hilos = await db.select().from(hiloComentarios);
    expect(hilos.map((h) => [h.publicacionId, h.conteoFuente, h.completo]).sort()).toEqual([
      [idIg, 1, true],
      [idTt, 1, true],
    ]);
    // Ni el nombre ni el id de la persona llegaron a la base.
    const todo = JSON.stringify(filas);
    expect(todo).not.toContain("17841446002302741");
    expect(todo).not.toContain("BTW · Software para negocios");
  });

  it("repetir la corrida no duplica ni vuelve a pedir hilos que no cambiaron", async () => {
    const { cliente } = clienteFalso({ hilos: hilosReales() });
    await leer(cliente);
    const g2 = clienteFalso({ hilos: hilosReales() });
    const r = await leer(g2.cliente, new Date(AHORA.getTime() + HORA));
    expect(r.comentariosNuevos).toBe(0);
    expect(g2.pedidos).toEqual([]);
    expect(await db.select().from(comentario)).toHaveLength(2);
  });

  it("si el hilo se vuelve a leer (conteo cambió), actualiza sin duplicar y conserva leido_en", async () => {
    const g1 = clienteFalso({ hilos: { [POST_IG]: { comentarios: [deOtro("c1", { likeCount: 1 })] } } });
    await leer(g1.cliente);
    const lista2 = lista().map((f) => (typeof f === "object" && f !== null && (f as { id?: string }).id === POST_IG ? { ...f, commentCount: 2 } : f));
    const g2 = clienteFalso({
      lista: lista2,
      hilos: { [POST_IG]: { comentarios: [deOtro("c1", { likeCount: 5, message: "editado" }), deOtro("c2")] } },
    });
    const r = await leer(g2.cliente, new Date(AHORA.getTime() + HORA));
    expect(r.comentariosNuevos).toBe(1);
    const c1 = (await db.select().from(comentario).where(eq(comentario.idPlataforma, "c1")))[0];
    expect(c1).toMatchObject({ texto: "editado", meGusta: 5 });
    expect(c1?.leidoEn.toISOString()).toBe(AHORA.toISOString());
    expect(c1?.actualizadoEn.toISOString()).toBe(new Date(AHORA.getTime() + HORA).toISOString());
  });

  it("guarda las respuestas con su padre", async () => {
    const g = clienteFalso({
      hilos: { [POST_IG]: { comentarios: [deOtro("c1", { replyCount: 1, replies: [deOtro("c1a", { parentId: "c1" })] })] } },
    });
    await leer(g.cliente);
    const hija = (await db.select().from(comentario).where(eq(comentario.idPlataforma, "c1a")))[0];
    expect(hija?.padreIdPlataforma).toBe("c1");
  });

  describe("desaparecidos", () => {
    const cambia = (n: number) =>
      lista().map((f) => (typeof f === "object" && f !== null && (f as { id?: string }).id === POST_IG ? { ...f, commentCount: n } : f));

    async function sembrar(): Promise<void> {
      const g = clienteFalso({
        hilos: {
          [POST_TT]: { comentarios: hiloTt() },
          [POST_IG]: {
            comentarios: [
              deOtro("c1", { replyCount: 1, replies: [deOtro("c1a", { parentId: "c1" })] }),
              deOtro("c2"),
            ],
          },
        },
      });
      await leer(g.cliente);
    }
    const desaparecidos = async (): Promise<string[]> =>
      (await db.select().from(comentario))
        .filter((c) => c.desaparecioEn !== null)
        .map((c) => c.idPlataforma)
        .sort();

    it("un hilo completo marca los que ya no vienen, con sus respuestas; no borra nada", async () => {
      await sembrar();
      const g = clienteFalso({ lista: cambia(3), hilos: { [POST_IG]: { comentarios: [deOtro("c2")] } } });
      await leer(g.cliente, new Date(AHORA.getTime() + HORA));
      expect(await desaparecidos()).toEqual(["c1", "c1a"]);
      expect(await db.select().from(comentario)).toHaveLength(4);
      const c1 = (await db.select().from(comentario).where(eq(comentario.idPlataforma, "c1")))[0];
      expect(c1?.desaparecioEn?.toISOString()).toBe(new Date(AHORA.getTime() + HORA).toISOString());
    });

    it("si el comentario vuelve a aparecer, desaparecio_en vuelve a null", async () => {
      await sembrar();
      const g = clienteFalso({ lista: cambia(3), hilos: { [POST_IG]: { comentarios: [deOtro("c2")] } } });
      await leer(g.cliente, new Date(AHORA.getTime() + HORA));
      const g2 = clienteFalso({
        lista: cambia(4),
        hilos: { [POST_IG]: { comentarios: [deOtro("c1"), deOtro("c2")] } },
      });
      await leer(g2.cliente, new Date(AHORA.getTime() + 2 * HORA));
      expect(await desaparecidos()).toEqual(["c1a"]);
    });

    it("un hilo incompleto no marca nada, y queda para releerse", async () => {
      await sembrar();
      const g = clienteFalso({ lista: cambia(3), hilos: { [POST_IG]: { comentarios: [deOtro("c2")], completo: false } } });
      await leer(g.cliente, new Date(AHORA.getTime() + HORA));
      expect(await desaparecidos()).toEqual([]);
      const [h] = await db.select().from(hiloComentarios).where(eq(hiloComentarios.publicacionId, idIg));
      expect(h?.completo).toBe(false);
      const g2 = clienteFalso({ lista: cambia(3), hilos: { [POST_IG]: { comentarios: [deOtro("c2")] } } });
      await leer(g2.cliente, new Date(AHORA.getTime() + 2 * HORA));
      expect(g2.pedidos).toEqual([POST_IG]);
      expect(await desaparecidos()).toEqual(["c1", "c1a"]);
    });

    it("un hilo que falla no marca nada y se anota", async () => {
      await sembrar();
      const g = clienteFalso({ lista: cambia(3), hilos: { [POST_IG]: new ErrorFuente("HTTP 400: Invalid character '<'") } });
      const r = await leer(g.cliente, new Date(AHORA.getTime() + HORA));
      expect(await desaparecidos()).toEqual([]);
      expect(r.errores).toHaveLength(1);
      expect(r.errores[0]).toContain(POST_IG);
      // Sigue con el estado anterior: la próxima corrida lo vuelve a pedir.
      const [h] = await db.select().from(hiloComentarios).where(eq(hiloComentarios.publicacionId, idIg));
      expect(h?.conteoFuente).toBe(1);
    });

    it("un comentario que no se entiende deja el hilo como incompleto", async () => {
      await sembrar();
      const g = clienteFalso({ lista: cambia(3), hilos: { [POST_IG]: { comentarios: [deOtro("c2"), { message: "sin id" }] } } });
      const r = await leer(g.cliente, new Date(AHORA.getTime() + HORA));
      expect(await desaparecidos()).toEqual([]);
      expect(r.errores).toHaveLength(1);
    });
  });

  it("un hilo que falla no corta a los demás", async () => {
    const g = clienteFalso({ hilos: { [POST_IG]: new Error("caído"), [POST_TT]: { comentarios: hiloTt() } } });
    const r = await leer(g.cliente);
    expect(r.hilosLeidos).toBe(1);
    expect(r.comentariosNuevos).toBe(1);
    expect(r.errores).toHaveLength(1);
    expect(g.pedidos.sort()).toEqual([POST_IG, POST_TT].sort());
  });

  it("una fila sin publicación se ignora, y una de pauta también", async () => {
    const extra = [
      { id: "99999", accountId: "a", platform: "instagram", commentCount: 4, createdTime: "2026-11-05T18:39:26.000Z" },
      { id: POST_TT, accountId: "a", platform: "tiktok", commentCount: 4, isAd: true },
    ];
    const g = clienteFalso({ lista: [...extra], hilos: {} });
    const r = await leer(g.cliente);
    expect(r).toMatchObject({ comentariosNuevos: 0, hilosLeidos: 0, errores: [] });
    expect(g.pedidos).toEqual([]);
    expect(await db.select().from(comentario)).toHaveLength(0);
  });

  it("no pide hilos de posts con conteo 0 que nunca tuvieron comentarios", async () => {
    const g = clienteFalso({ hilos: hilosReales() });
    await leer(g.cliente);
    expect(g.pedidos.sort()).toEqual([POST_IG, POST_TT].sort());
  });

  describe("dentro del recolector", () => {
    const corre = (c: ClienteZernio, ahora: Date) =>
      recolectar(db, { zernio: c, ahora: () => ahora, origen: "cli", secretos: ["llave-secreta-1"] });
    const abierta = async () =>
      (await db.select().from(alerta).where(and(eq(alerta.clave, "fuente:zernio:comentarios"), isNull(alerta.resueltaEn)))).length;

    it("suma comentariosNuevos al resumen", async () => {
      const r = await corre(clienteFalso({ hilos: hilosReales() }).cliente, AHORA);
      if (r.estado === "ocupado") throw new Error("ocupado");
      expect(r.comentariosNuevos).toBe(2);
      expect(r.estado).toBe("ok");
    });

    it("un hilo que falla abre fuente:zernio:comentarios y la siguiente corrida buena la cierra", async () => {
      const mal = clienteFalso({ hilos: { [POST_IG]: new ErrorFuente("HTTP 400: llave-secreta-1 mal"), [POST_TT]: { comentarios: hiloTt() } } });
      const r = await corre(mal.cliente, AHORA);
      if (r.estado === "ocupado") throw new Error("ocupado");
      expect(r.estado).toBe("parcial");
      expect(await abierta()).toBe(1);
      const [a] = await db.select().from(alerta).where(eq(alerta.clave, "fuente:zernio:comentarios"));
      expect(a?.mensaje).toContain("comentarios");
      expect(a?.mensaje).not.toContain("llave-secreta-1");
      // El otro hilo sí se guardó.
      expect(await db.select().from(comentario)).toHaveLength(1);

      const bien = clienteFalso({ hilos: hilosReales() });
      const r2 = await corre(bien.cliente, new Date(AHORA.getTime() + HORA));
      if (r2.estado === "ocupado") throw new Error("ocupado");
      expect(r2.estado).toBe("ok");
      expect(await abierta()).toBe(0);
      expect(bien.pedidos).toEqual([POST_IG]);
      expect(await db.select().from(comentario)).toHaveLength(2);
    });
  });
});
