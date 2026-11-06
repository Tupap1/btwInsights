// Editar borradores contra la base de pruebas, con un cliente de Zernio simulado (nunca la API real).
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { publicacion } from "../db/esquema";
import type { EstadoPublicacion, OrigenPublicacion, Red } from "../tipos";
import { ErrorEdicion, guardarEdicion, revisarEdicion } from "./editar";

const AHORA = new Date("2026-11-06T17:00:00Z");
const FUTURO = new Date("2026-11-20T15:00:00Z");

describe.skipIf(!hayBd)("editar borrador", () => {
  const db = bd();
  afterAll(cerrarBd);
  beforeEach(async () => {
    await vaciar(db);
  });

  async function crear(p: { red?: Red; estado?: EstadoPublicacion; origen?: OrigenPublicacion; zernioPostId?: string | null }) {
    const [f] = await db
      .insert(publicacion)
      .values({
        red: p.red ?? "instagram",
        estado: p.estado ?? "borrador",
        origen: p.origen ?? "zernio",
        zernioPostId: p.zernioPostId === undefined ? "zp1" : p.zernioPostId,
        texto: "texto viejo",
        programadoPara: new Date("2026-11-16T00:30:00Z"),
      })
      .returning({ id: publicacion.id });
    return f?.id as number;
  }
  const cliente = () => ({ editarBorrador: vi.fn(async () => {}) });

  it("revisar devuelve el resumen y no escribe ni llama a Zernio", async () => {
    const id = await crear({});
    const r = await revisarEdicion(db, { publicacionId: id, texto: "nuevo", programadoPara: FUTURO }, AHORA);
    expect(r.cambios).toHaveLength(2);
    const [fila] = await db.select().from(publicacion).where(eq(publicacion.id, id));
    expect(fila?.texto).toBe("texto viejo");
  });

  it("guardar llama a Zernio con el id de Zernio y luego actualiza texto y fecha", async () => {
    const id = await crear({ red: "tiktok" });
    const c = cliente();
    await guardarEdicion(db, { publicacionId: id, texto: "nuevo", programadoPara: FUTURO }, c, AHORA);
    expect(c.editarBorrador).toHaveBeenCalledWith("zp1", { contenido: "nuevo", programadoPara: FUTURO });
    const [fila] = await db.select().from(publicacion).where(eq(publicacion.id, id));
    expect(fila?.texto).toBe("nuevo");
    expect(fila?.programadoPara?.toISOString()).toBe(FUTURO.toISOString());
    expect(fila?.estado).toBe("borrador");
  });

  it("solo manda lo que cambió", async () => {
    const id = await crear({});
    const c = cliente();
    await guardarEdicion(db, { publicacionId: id, texto: "texto viejo", programadoPara: FUTURO }, c, AHORA);
    expect(c.editarBorrador).toHaveBeenCalledWith("zp1", { programadoPara: FUTURO });
  });

  it("si Zernio falla, la base no cambia y el error es genérico", async () => {
    const id = await crear({});
    const c = { editarBorrador: vi.fn(async () => { throw new Error("HTTP 400: clave zk_secreta"); }) };
    const e = await guardarEdicion(db, { publicacionId: id, texto: "nuevo" }, c, AHORA).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorEdicion);
    expect((e as Error).message).not.toContain("zk_secreta");
    const [fila] = await db.select().from(publicacion).where(eq(publicacion.id, id));
    expect(fila?.texto).toBe("texto viejo");
  });

  it("rechaza Facebook, lo que no es borrador, lo que no es de Zernio, sin zernioPostId y fechas pasadas", async () => {
    const casos: [Parameters<typeof crear>[0], { texto?: string; programadoPara?: Date }][] = [
      [{ red: "facebook" }, { texto: "x" }],
      [{ estado: "programado" }, { texto: "x" }],
      [{ estado: "publicado" }, { texto: "x" }],
      [{ origen: "meta" }, { texto: "x" }],
      [{ zernioPostId: null }, { texto: "x" }],
      [{}, { programadoPara: new Date("2026-11-05T00:00:00Z") }],
      [{}, { programadoPara: AHORA }],
      [{}, {}],
      [{}, { texto: "   " }],
    ];
    for (const [p, cambios] of casos) {
      await db.delete(publicacion);
      const id = await crear(p);
      const c = cliente();
      await expect(guardarEdicion(db, { publicacionId: id, ...cambios }, c, AHORA)).rejects.toBeInstanceOf(ErrorEdicion);
      expect(c.editarBorrador).not.toHaveBeenCalled();
      await expect(revisarEdicion(db, { publicacionId: id, ...cambios }, AHORA)).rejects.toBeInstanceOf(ErrorEdicion);
    }
  });

  it("una publicación que no existe se rechaza", async () => {
    await expect(revisarEdicion(db, { publicacionId: 999, texto: "x" }, AHORA)).rejects.toBeInstanceOf(ErrorEdicion);
  });
});
