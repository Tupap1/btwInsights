import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../pruebas/bd";
import { bd, cerrarBd } from "./db/cliente";
import { alerta, lectura, publicacion, reel } from "./db/esquema";
import { abrirAlerta, guardarLectura, guardarPublicacion, resolverAlertas } from "./guardar";
import { cifrasVacias, type LecturaVista, type PublicacionVista } from "./tipos";

const base = (extra: Partial<PublicacionVista> = {}): PublicacionVista => ({
  red: "instagram",
  origen: "meta",
  cuenta: "btwone.co",
  postIdPlataforma: "18120342799999707",
  zernioPostId: null,
  etiquetas: [],
  enlace: "https://www.instagram.com/reel/x/",
  texto: "Montaste tu lavadero con $20 millones",
  duracionS: null,
  programadoPara: null,
  publicadoEn: new Date("2026-11-05T18:39:00Z"),
  estado: "publicado",
  ...extra,
});

const lecturaDe = (fuente: "meta" | "zernio", vistas: number, momento: string): LecturaVista => ({
  fuente,
  via: "api",
  datoActualizadoEn: new Date(momento),
  cifras: { ...cifrasVacias(), vistas },
  reacciones: null,
  paisPrincipal: null,
  curva: fuente === "zernio" ? { "0": 100, "1": 61 } : null,
  errores: [],
});

describe.skipIf(!hayBd)("guardar en la base", () => {
  const db = bd();
  beforeEach(async () => {
    await vaciar(db);
    await db.insert(reel).values([{ id: "10" }, { id: "09b" }]);
  });
  afterAll(cerrarBd);

  it("el mismo post visto por Meta y por Zernio es una sola publicación con dos lecturas", async () => {
    const a = await guardarPublicacion(db, base(), { reelId: "10", por: "fecha_texto" });
    const b = await guardarPublicacion(db, base({ origen: "zernio", texto: null }), { reelId: "10", por: "fecha_texto" });
    expect(b.id).toBe(a.id);
    expect(b.nueva).toBe(false);
    const [p] = await db.select().from(publicacion);
    expect(p?.texto).toBe("Montaste tu lavadero con $20 millones"); // el null de Zernio no borró el texto

    expect(await guardarLectura(db, a.id, base().publicadoEn, lecturaDe("meta", 1275, "2026-11-06T04:00:00Z"), new Date())).toBe(true);
    expect(await guardarLectura(db, a.id, base().publicadoEn, lecturaDe("zernio", 918, "2026-11-06T02:08:00Z"), new Date())).toBe(true);
    // Zernio no ha vuelto a sincronizar: mismo lastUpdated, no se duplica.
    expect(await guardarLectura(db, a.id, base().publicadoEn, lecturaDe("zernio", 918, "2026-11-06T02:08:00Z"), new Date())).toBe(false);
    const ls = await db.select().from(lectura).where(eq(lectura.publicacionId, a.id));
    expect(ls.map((l) => [l.fuente, l.vistas]).sort()).toEqual([["meta", 1275], ["zernio", 918]]);
    expect(ls.find((l) => l.fuente === "meta")?.horasDesdePublicacion).toBeCloseTo(9.35, 2);
  });

  it("una asignación a mano no se cambia; una automática se mejora con una más segura", async () => {
    const a = await guardarPublicacion(db, base(), { reelId: "09b", por: "fecha_texto" });
    const b = await guardarPublicacion(db, base(), { reelId: "10", por: "id" });
    expect(b.reelId).toBe("10");
    await db.update(publicacion).set({ reelId: "09b", emparejadoPor: "manual" }).where(eq(publicacion.id, a.id));
    const c = await guardarPublicacion(db, base(), { reelId: "10", por: "id" });
    expect(c.reelId).toBe("09b");
  });

  it("un borrador de Zernio que luego sale publicado se actualiza, no se duplica", async () => {
    const borrador = base({ red: "tiktok", origen: "zernio", postIdPlataforma: null, zernioPostId: "z1", estado: "borrador", publicadoEn: null });
    const a = await guardarPublicacion(db, borrador, { reelId: "10", por: "id" });
    const b = await guardarPublicacion(db, { ...borrador, postIdPlataforma: "7704758213807312180", estado: "publicado" }, { reelId: null, por: null });
    expect(b.id).toBe(a.id);
    expect(b.reelId).toBe("10");
    const [p] = await db.select().from(publicacion);
    expect(p?.estado).toBe("publicado");
  });

  it("fecha_texto no cae en un reel que ya tiene otra publicación publicada en esa red", async () => {
    await guardarPublicacion(db, base({ red: "tiktok", postIdPlataforma: "del-29" }), { reelId: "10", por: "id" });
    const otra = await guardarPublicacion(db, base({ red: "tiktok", postIdPlataforma: "del-28" }), { reelId: "10", por: "fecha_texto" });
    expect(otra.reelId).toBeNull();
    // Un borrador del mismo reel y red no estorba.
    await guardarPublicacion(db, base({ red: "facebook", postIdPlataforma: null, zernioPostId: "zb", estado: "borrador" }), { reelId: "10", por: "id" });
    const fb = await guardarPublicacion(db, base({ red: "facebook", postIdPlataforma: "fb-1" }), { reelId: "10", por: "fecha_texto" });
    expect(fb.reelId).toBe("10");
  });

  it("una alerta abierta no se repite y se puede cerrar", async () => {
    const nueva = { clave: "fuente:meta", tipo: "fuente", mensaje: "Meta no respondió" };
    await abrirAlerta(db, nueva);
    await abrirAlerta(db, nueva);
    expect(await db.select().from(alerta)).toHaveLength(1);
    await resolverAlertas(db, ["fuente:meta"]);
    await abrirAlerta(db, nueva);
    expect(await db.select().from(alerta)).toHaveLength(2);
  });
});
