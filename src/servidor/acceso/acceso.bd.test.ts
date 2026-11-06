import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hayBd, vaciarAcceso } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { desafio, invitacion, sesion, usuario } from "../db/esquema";
import { consumirDesafio, crearDesafio } from "./desafios";
import { consumirInvitacion, crearInvitacion, validarInvitacion } from "./invitaciones";
import { cerrarSesion, crearSesion, validarSesion } from "./sesiones";
import { hashDe } from "./tokens";

const T0 = new Date("2026-11-06T12:00:00Z");
const mas = (d: Date, ms: number) => new Date(d.getTime() + ms);
const HORA = 3600_000;
const DIA = 24 * HORA;

describe.skipIf(!hayBd)("acceso en la base", () => {
  const db = bd();
  beforeEach(() => vaciarAcceso(db));
  afterAll(() => cerrarBd());

  describe("invitaciones", () => {
    it("crea el usuario y una invitación de 24 h; reusa el usuario si ya existe", async () => {
      const a = await crearInvitacion(db, "Andrés", T0);
      expect(a.expiraEn.getTime()).toBe(T0.getTime() + DIA);
      const b = await crearInvitacion(db, "Andrés", T0);
      expect(b.usuarioId).toBe(a.usuarioId);
      expect(b.token).not.toBe(a.token);
      expect(await db.select().from(usuario)).toHaveLength(1);
    });

    it("sirve una sola vez", async () => {
      const { token, usuarioId } = await crearInvitacion(db, "Andrés", T0);
      expect(await validarInvitacion(db, token, T0)).toEqual({ usuarioId, nombre: "Andrés" });
      expect(await consumirInvitacion(db, token, mas(T0, HORA))).toBe(usuarioId);
      expect(await consumirInvitacion(db, token, mas(T0, HORA))).toBeNull();
      expect(await validarInvitacion(db, token, mas(T0, HORA))).toBeNull();
      // Se marca usada, no se borra.
      expect(await db.select().from(invitacion)).toHaveLength(1);
    });

    it("vencida no sirve", async () => {
      const { token } = await crearInvitacion(db, "Andrés", T0);
      expect(await validarInvitacion(db, token, mas(T0, DIA + 1))).toBeNull();
      expect(await consumirInvitacion(db, token, mas(T0, DIA + 1))).toBeNull();
    });

    it("un token inventado no sirve y en la base no está el token en claro", async () => {
      const { token } = await crearInvitacion(db, "Andrés", T0);
      expect(await validarInvitacion(db, "inventado", T0)).toBeNull();
      const filas = await db.select().from(invitacion);
      expect(JSON.stringify(filas)).not.toContain(token);
      expect(filas[0]?.hash).toBe(hashDe(token));
    });

    it("no invita a un usuario inactivo", async () => {
      await crearInvitacion(db, "Andrés", T0);
      await db.update(usuario).set({ activo: false });
      await expect(crearInvitacion(db, "Andrés", T0)).rejects.toThrow();
    });
  });

  describe("desafíos", () => {
    it("sirve una sola vez", async () => {
      const id = await crearDesafio(db, { reto: "abc", tipo: "entrada" }, T0);
      expect(await consumirDesafio(db, id, "entrada", mas(T0, 1000))).toEqual({ reto: "abc", usuarioId: null });
      expect(await consumirDesafio(db, id, "entrada", mas(T0, 1000))).toBeNull();
      expect(await db.select().from(desafio)).toHaveLength(0);
    });

    it("vencido (5 min) no sirve", async () => {
      const id = await crearDesafio(db, { reto: "abc", tipo: "entrada" }, T0);
      expect(await consumirDesafio(db, id, "entrada", mas(T0, 5 * 60_000 + 1))).toBeNull();
    });

    it("no sirve para otro tipo", async () => {
      const id = await crearDesafio(db, { reto: "abc", tipo: "registro" }, T0);
      expect(await consumirDesafio(db, id, "entrada", T0)).toBeNull();
    });

    it("al crear uno nuevo se limpian los vencidos", async () => {
      await crearDesafio(db, { reto: "viejo", tipo: "entrada" }, T0);
      await crearDesafio(db, { reto: "nuevo", tipo: "entrada" }, mas(T0, HORA));
      const filas = await db.select().from(desafio);
      expect(filas.map((f) => f.reto)).toEqual(["nuevo"]);
    });
  });

  describe("sesiones", () => {
    it("sirve hasta los 30 días y después no", async () => {
      const { usuarioId } = await crearInvitacion(db, "Andrés", T0);
      const { token, expiraEn } = await crearSesion(db, usuarioId, T0);
      expect(expiraEn.getTime()).toBe(T0.getTime() + 30 * DIA);
      expect(await validarSesion(db, token, mas(T0, 29 * DIA))).toEqual({ usuarioId, nombre: "Andrés" });
      expect(await validarSesion(db, token, mas(T0, 30 * DIA + 1))).toBeNull();
    });

    it("un usuario inactivo no entra", async () => {
      const { usuarioId } = await crearInvitacion(db, "Andrés", T0);
      const { token } = await crearSesion(db, usuarioId, T0);
      await db.update(usuario).set({ activo: false }).where(eq(usuario.id, usuarioId));
      expect(await validarSesion(db, token, T0)).toBeNull();
    });

    it("en la base no aparece el token en claro y un token inventado no entra", async () => {
      const { usuarioId } = await crearInvitacion(db, "Andrés", T0);
      const { token } = await crearSesion(db, usuarioId, T0);
      const filas = await db.select().from(sesion);
      expect(JSON.stringify(filas)).not.toContain(token);
      expect(filas[0]?.hash).toBe(hashDe(token));
      expect(await validarSesion(db, "inventado", T0)).toBeNull();
    });

    it("actualiza usadaEn como mucho una vez por minuto", async () => {
      const { usuarioId } = await crearInvitacion(db, "Andrés", T0);
      const { token } = await crearSesion(db, usuarioId, T0);
      await validarSesion(db, token, mas(T0, 10_000));
      expect((await db.select().from(sesion))[0]?.usadaEn?.getTime()).toBe(T0.getTime());
      await validarSesion(db, token, mas(T0, 61_000));
      expect((await db.select().from(sesion))[0]?.usadaEn?.getTime()).toBe(T0.getTime() + 61_000);
      await validarSesion(db, token, mas(T0, 90_000));
      expect((await db.select().from(sesion))[0]?.usadaEn?.getTime()).toBe(T0.getTime() + 61_000);
    });

    it("salir borra la sesión", async () => {
      const { usuarioId } = await crearInvitacion(db, "Andrés", T0);
      const { token } = await crearSesion(db, usuarioId, T0);
      await cerrarSesion(db, token);
      expect(await validarSesion(db, token, T0)).toBeNull();
      expect(await db.select().from(sesion)).toHaveLength(0);
    });
  });
});
