import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hayBd, vaciarAcceso } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { credencial, invitacion, sesion, usuario } from "../db/esquema";
import { crearInvitacion } from "./invitaciones";
import { validarSesion } from "./sesiones";
import {
  iniciarEntrada,
  iniciarRegistro,
  terminarEntrada,
  terminarRegistro,
  type ConfigWebauthn,
  type RespuestaEntrada,
  type RespuestaRegistro,
  type VerificarEntrada,
  type VerificarRegistro,
} from "./webauthn";

const T0 = new Date("2026-11-06T12:00:00Z");
const cfg: ConfigWebauthn = { rpId: "localhost", origen: "http://localhost:3000", rpNombre: "BTW Insights" };
const respReg = { id: "cred-1", rawId: "cred-1", type: "public-key", response: {}, clientExtensionResults: {} } as unknown as RespuestaRegistro;
const respEnt = { id: "cred-1", rawId: "cred-1", type: "public-key", response: {}, clientExtensionResults: {} } as unknown as RespuestaEntrada;

const regBueno: VerificarRegistro = async () => ({
  verified: true,
  credential: { id: "cred-1", publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] },
});
const regMalo: VerificarRegistro = async () => ({ verified: false });
const regLanza: VerificarRegistro = async () => {
  throw new Error("firma mala");
};
const entrada = (verified: boolean, newCounter: number): VerificarEntrada => async () => ({ verified, newCounter });

describe.skipIf(!hayBd)("WebAuthn en la base", () => {
  const db = bd();
  beforeEach(() => vaciarAcceso(db));
  afterAll(() => cerrarBd());

  async function conInvitacion() {
    const inv = await crearInvitacion(db, "Andrés", T0);
    const ini = await iniciarRegistro(db, cfg, inv.token, T0);
    if (!ini) throw new Error("no inició");
    return { inv, ini };
  }

  describe("registro", () => {
    it("inicia con residentKey y userVerification requeridos, sin attestation", async () => {
      const { ini } = await conInvitacion();
      expect(ini.opciones.rp.id).toBe("localhost");
      expect(ini.opciones.authenticatorSelection?.residentKey).toBe("required");
      expect(ini.opciones.authenticatorSelection?.userVerification).toBe("required");
      expect(ini.opciones.attestation).toBe("none");
    });

    it("no inicia con una invitación mala o vencida", async () => {
      expect(await iniciarRegistro(db, cfg, "inventado", T0)).toBeNull();
      const inv = await crearInvitacion(db, "Andrés", T0);
      expect(await iniciarRegistro(db, cfg, inv.token, new Date(T0.getTime() + 25 * 3600_000))).toBeNull();
    });

    it("guarda la credencial, crea la sesión y deja la invitación usada", async () => {
      const { inv, ini } = await conInvitacion();
      const r = await terminarRegistro(db, cfg, { token: inv.token, desafioId: ini.desafioId, respuesta: respReg }, regBueno, T0);
      expect(r).not.toBeNull();
      const creds = await db.select().from(credencial);
      expect(creds).toHaveLength(1);
      expect(creds[0]).toMatchObject({ id: "cred-1", usuarioId: inv.usuarioId, clavePublica: "AQID", contador: 0 });
      expect((await db.select().from(invitacion))[0]?.usadaEn).not.toBeNull();
      expect(await validarSesion(db, r?.token ?? "", T0)).toMatchObject({ usuarioId: inv.usuarioId });
    });

    it("verified:false no entra y la invitación sigue sirviendo", async () => {
      const { inv, ini } = await conInvitacion();
      expect(await terminarRegistro(db, cfg, { token: inv.token, desafioId: ini.desafioId, respuesta: respReg }, regMalo, T0)).toBeNull();
      expect(await db.select().from(credencial)).toHaveLength(0);
      expect(await db.select().from(sesion)).toHaveLength(0);
      expect((await db.select().from(invitacion))[0]?.usadaEn).toBeNull();
    });

    it("si la verificación lanza, tampoco entra", async () => {
      const { inv, ini } = await conInvitacion();
      expect(await terminarRegistro(db, cfg, { token: inv.token, desafioId: ini.desafioId, respuesta: respReg }, regLanza, T0)).toBeNull();
    });

    it("el desafío no se reusa", async () => {
      const { inv, ini } = await conInvitacion();
      await terminarRegistro(db, cfg, { token: inv.token, desafioId: ini.desafioId, respuesta: respReg }, regMalo, T0);
      expect(await terminarRegistro(db, cfg, { token: inv.token, desafioId: ini.desafioId, respuesta: respReg }, regBueno, T0)).toBeNull();
    });

    it("una invitación ya usada no registra otra llave", async () => {
      const { inv, ini } = await conInvitacion();
      await terminarRegistro(db, cfg, { token: inv.token, desafioId: ini.desafioId, respuesta: respReg }, regBueno, T0);
      expect(await iniciarRegistro(db, cfg, inv.token, T0)).toBeNull();
    });

    it("el desafío de otro usuario no sirve con esta invitación", async () => {
      const a = await crearInvitacion(db, "Andrés", T0);
      const b = await crearInvitacion(db, "Fernando", T0);
      const iniB = await iniciarRegistro(db, cfg, b.token, T0);
      expect(await terminarRegistro(db, cfg, { token: a.token, desafioId: iniB?.desafioId ?? "", respuesta: respReg }, regBueno, T0)).toBeNull();
    });
  });

  describe("entrada", () => {
    async function conCredencial(contador: number) {
      const inv = await crearInvitacion(db, "Andrés", T0);
      await db.insert(credencial).values({ id: "cred-1", usuarioId: inv.usuarioId, clavePublica: "AQID", contador, transportes: [] });
      const ini = await iniciarEntrada(db, cfg, T0);
      return { inv, ini };
    }

    it("inicia sin allowCredentials y con userVerification requerido", async () => {
      const { ini } = await conCredencial(0);
      expect(ini.opciones.allowCredentials ?? []).toHaveLength(0);
      expect(ini.opciones.userVerification).toBe("required");
    });

    it("entra, sube el contador y marca usadaEn", async () => {
      const { inv, ini } = await conCredencial(5);
      const r = await terminarEntrada(db, cfg, { desafioId: ini.desafioId, respuesta: respEnt }, entrada(true, 6), T0);
      expect(r).not.toBeNull();
      const c = (await db.select().from(credencial))[0];
      expect(c?.contador).toBe(6);
      expect(c?.usadaEn?.getTime()).toBe(T0.getTime());
      expect(await validarSesion(db, r?.token ?? "", T0)).toMatchObject({ usuarioId: inv.usuarioId });
    });

    it("verified:false no entra", async () => {
      const { ini } = await conCredencial(5);
      expect(await terminarEntrada(db, cfg, { desafioId: ini.desafioId, respuesta: respEnt }, entrada(false, 6), T0)).toBeNull();
      expect(await db.select().from(sesion)).toHaveLength(0);
    });

    it("un contador que retrocede o se repite no entra", async () => {
      for (const nuevo of [5, 4]) {
        await vaciarAcceso(db);
        const { ini } = await conCredencial(5);
        expect(await terminarEntrada(db, cfg, { desafioId: ini.desafioId, respuesta: respEnt }, entrada(true, nuevo), T0)).toBeNull();
        expect((await db.select().from(credencial))[0]?.contador).toBe(5);
      }
    });

    it("las llaves que siempre dan 0 entran (contador 0 y 0)", async () => {
      const { ini } = await conCredencial(0);
      expect(await terminarEntrada(db, cfg, { desafioId: ini.desafioId, respuesta: respEnt }, entrada(true, 0), T0)).not.toBeNull();
    });

    it("una credencial desconocida no entra", async () => {
      await conCredencial(0);
      const ini = await iniciarEntrada(db, cfg, T0);
      const otra = { ...respEnt, id: "otra", rawId: "otra" } as RespuestaEntrada;
      expect(await terminarEntrada(db, cfg, { desafioId: ini.desafioId, respuesta: otra }, entrada(true, 1), T0)).toBeNull();
    });

    it("un usuario inactivo no entra", async () => {
      const { inv, ini } = await conCredencial(0);
      await db.update(usuario).set({ activo: false }).where(eq(usuario.id, inv.usuarioId));
      expect(await terminarEntrada(db, cfg, { desafioId: ini.desafioId, respuesta: respEnt }, entrada(true, 1), T0)).toBeNull();
    });

    it("el desafío vencido o repetido no sirve", async () => {
      const { ini } = await conCredencial(0);
      const tarde = new Date(T0.getTime() + 6 * 60_000);
      expect(await terminarEntrada(db, cfg, { desafioId: ini.desafioId, respuesta: respEnt }, entrada(true, 1), tarde)).toBeNull();
      const ini2 = await iniciarEntrada(db, cfg, T0);
      await terminarEntrada(db, cfg, { desafioId: ini2.desafioId, respuesta: respEnt }, entrada(true, 1), T0);
      expect(await terminarEntrada(db, cfg, { desafioId: ini2.desafioId, respuesta: respEnt }, entrada(true, 2), T0)).toBeNull();
    });
  });
});
