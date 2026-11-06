import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { alerta, corrida, publicacion, reel } from "../db/esquema";
import { ErrorFuente } from "../fuentes/http";
import type { ClienteMeta } from "../fuentes/meta";
import type { ClienteZernio } from "../fuentes/zernio";
import { recolectar, type ResumenCorrida } from "./recolectar";

const SECRETO = "token-super-secreto-123";
const AHORA = new Date("2026-11-07T12:00:00Z"); // sábado 07:00 en Bogotá
const HORA = 3_600_000;

const fixture = (nombre: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "pruebas/fixtures/api", `${nombre}.json`), "utf8")) as unknown;

/** Zernio y Meta "vacíos": responden bien y no traen publicaciones. */
const zernioVacio: ClienteZernio = {
  cuentas: async () => [],
  analitica: async () => [],
  posts: async () => [],
  post: async () => ({}),
  historial: async () => ({}),
  seguidores: async () => ({ accounts: [] }),
};
const falla = (): Promise<never> => Promise.reject(new ErrorFuente("HTTP 500: caído"));
const zernioCaido: ClienteZernio = { ...zernioVacio, analitica: falla, posts: falla, seguidores: falla };
const metaVacio: ClienteMeta = {
  reelsFacebook: async () => [],
  mediaInstagram: async () => [],
  metricas: async () => ({}),
  cuentaFacebook: async () => fixture("meta-fb-pagina"),
  cuentaInstagram: async () => fixture("meta-ig-cuenta"),
};
const metaCaido: ClienteMeta = { reelsFacebook: falla, mediaInstagram: falla, metricas: falla, cuentaFacebook: falla, cuentaInstagram: falla };
const metaConError = (codigo: number): ClienteMeta => ({
  ...metaVacio,
  cuentaFacebook: () => Promise.reject(new ErrorFuente(`HTTP 400: ${SECRETO} error`, { estado: 400, codigo })),
});

describe.skipIf(!hayBd)("alertas de T19 en la base", { timeout: 60_000 }, () => {
  const db = bd();
  const corre = async (extra: { ahora?: Date; zernio?: ClienteZernio; meta?: ClienteMeta } = {}): Promise<ResumenCorrida> => {
    const ahora = extra.ahora ?? AHORA;
    const r = await recolectar(db, {
      zernio: extra.zernio ?? zernioVacio,
      meta: extra.meta ?? metaVacio,
      ahora: () => ahora,
      origen: "cli",
      secretos: [SECRETO],
    });
    if (r.estado === "ocupado") throw new Error("ocupado");
    return r;
  };
  const abiertas = async (prefijo: string): Promise<string[]> =>
    (await db.select().from(alerta).where(isNull(alerta.resueltaEn))).map((a) => a.clave).filter((c) => c.startsWith(prefijo)).sort();
  const todasDe = async (clave: string) => (await db.select().from(alerta)).filter((a) => a.clave === clave);

  beforeEach(async () => {
    await vaciar(db);
    await db.insert(reel).values([{ id: "14", etiquetaIa: true }, { id: "15", etiquetaIa: false }, { id: "16" }]);
  });
  afterAll(cerrarBd);

  it("más de 24 h sin leer: se abre, no se duplica y se cierra con una lectura buena", async () => {
    await db.insert(corrida).values({ origen: "cli", estado: "ok", iniciadaEn: new Date(AHORA.getTime() - 30 * HORA), terminadaEn: new Date(AHORA.getTime() - 30 * HORA) });
    const r = await corre({ zernio: zernioCaido, meta: metaCaido }); // todo falla: no cuenta como lectura
    expect(r.estado).toBe("error");
    expect(await abiertas("lectura:")).toEqual(["lectura:atrasada"]);
    await corre({ ahora: new Date(AHORA.getTime() + HORA), zernio: zernioCaido, meta: metaCaido });
    expect(await todasDe("lectura:atrasada")).toHaveLength(1);
    await corre({ ahora: new Date(AHORA.getTime() + 2 * HORA) });
    expect(await abiertas("lectura:")).toEqual([]);
  });

  it("sin ninguna corrida buena previa, una corrida fallida abre la alerta", async () => {
    await corre({ zernio: zernioCaido, meta: metaCaido });
    expect(await abiertas("lectura:")).toEqual(["lectura:atrasada"]);
  });

  it("dos videos el mismo día en la misma red: se abre, no se duplica y se cierra al cancelar uno", async () => {
    const [a, b] = await db
      .insert(publicacion)
      .values([
        { red: "tiktok", origen: "zernio", estado: "programado", reelId: "14", programadoPara: new Date("2026-11-09T00:30:00Z") },
        { red: "tiktok", origen: "zernio", estado: "programado", reelId: "16", programadoPara: new Date("2026-11-09T03:00:00Z") },
      ])
      .returning({ id: publicacion.id });
    await corre();
    await corre({ ahora: new Date(AHORA.getTime() + HORA) });
    expect(await abiertas("cola:2026-11-08:tiktok:doble")).toEqual(["cola:2026-11-08:tiktok:doble"]);
    expect(await todasDe("cola:2026-11-08:tiktok:doble")).toHaveLength(1);
    const [f] = await todasDe("cola:2026-11-08:tiktok:doble");
    expect(f?.mensaje).toContain("el 14 a las 19:30 y el 16 a las 22:00");
    await db.update(publicacion).set({ estado: "cancelado" }).where(eq(publicacion.id, b!.id));
    await corre({ ahora: new Date(AHORA.getTime() + 2 * HORA) });
    expect(await abiertas("cola:2026-11-08:tiktok:doble")).toEqual([]);
    expect(a).toBeDefined();
  });

  it("día sin video: se abre por día y red, y se cierra al programar uno", async () => {
    await corre();
    expect(await abiertas("cola:2026-11-08:instagram:sin-video")).toHaveLength(1);
    expect((await abiertas("cola:")).filter((c) => c.endsWith(":sin-video"))).toHaveLength(21);
    const [f] = await todasDe("cola:2026-11-08:instagram:sin-video");
    expect(f?.nivel).toBe("aviso");
    await db.insert(publicacion).values({ red: "instagram", origen: "zernio", estado: "borrador", reelId: "15", programadoPara: new Date("2026-11-09T00:30:00Z") });
    await corre({ ahora: new Date(AHORA.getTime() + HORA) });
    expect(await abiertas("cola:2026-11-08:instagram:sin-video")).toEqual([]);
    expect(await abiertas("cola:2026-11-08:tiktok:sin-video")).toHaveLength(1);
  });

  it("IA sin etiqueta: se abre con false o null, no se duplica y se cierra al marcarla", async () => {
    const [p] = await db
      .insert(publicacion)
      .values({ red: "tiktok", origen: "zernio", estado: "borrador", reelId: "14", programadoPara: new Date("2026-11-12T00:30:00Z"), marcaIa: false })
      .returning({ id: publicacion.id });
    const [q] = await db
      .insert(publicacion)
      .values({ red: "tiktok", origen: "zernio", estado: "borrador", reelId: "15", programadoPara: new Date("2026-11-12T00:30:00Z"), marcaIa: false })
      .returning({ id: publicacion.id });
    const clave = `cola:${p!.id}:ia-sin-etiqueta`;
    await corre();
    await corre({ ahora: new Date(AHORA.getTime() + HORA) });
    expect(await abiertas(`cola:${p!.id}:`)).toEqual([clave]); // el reel 15 no lleva IA: sin alerta
    expect(await abiertas(`cola:${q!.id}:ia`)).toEqual([]);
    expect(await todasDe(clave)).toHaveLength(1);
    await db.update(publicacion).set({ marcaIa: true }).where(eq(publicacion.id, p!.id));
    await corre({ ahora: new Date(AHORA.getTime() + 2 * HORA) });
    expect(await abiertas(`cola:${p!.id}:ia`)).toEqual([]);
    await db.update(publicacion).set({ marcaIa: null }).where(eq(publicacion.id, p!.id));
    await corre({ ahora: new Date(AHORA.getTime() + 3 * HORA) });
    expect(await abiertas(`cola:${p!.id}:ia`)).toEqual([clave]);
  });

  it("token de Meta (190): se abre sin la llave, no se duplica y se cierra cuando Meta se lee bien", async () => {
    await corre({ meta: metaConError(190) });
    await corre({ ahora: new Date(AHORA.getTime() + HORA), meta: metaConError(190) });
    expect(await abiertas("meta:")).toEqual(["meta:token"]);
    const [f] = await todasDe("meta:token");
    expect(f?.mensaje).not.toContain(SECRETO);
    expect(await todasDe("meta:token")).toHaveLength(1);
    await corre({ ahora: new Date(AHORA.getTime() + 2 * HORA) });
    expect(await abiertas("meta:")).toEqual([]);
  });

  it("permisos de Meta (10 y 200): abren meta:permisos y no meta:token", async () => {
    for (const codigo of [10, 200]) {
      await vaciar(db);
      await corre({ meta: metaConError(codigo) });
      expect(await abiertas("meta:")).toEqual(["meta:permisos"]);
    }
    await corre({ ahora: new Date(AHORA.getTime() + HORA) });
    expect(await abiertas("meta:")).toEqual([]);
  });

  it("otro error de Meta (500) no abre alertas de token ni de permisos", async () => {
    await corre({ meta: metaCaido });
    expect(await abiertas("meta:")).toEqual([]);
  });
});
