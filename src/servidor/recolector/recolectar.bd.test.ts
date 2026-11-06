import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../pruebas/bd";
import { bd, cerrarBd } from "../db/cliente";
import { alerta, corrida, lectura, publicacion, reel } from "../db/esquema";
import { ErrorFuente } from "../fuentes/http";
import { crearMeta, type ClienteMeta } from "../fuentes/meta";
import { crearZernio, type ClienteZernio } from "../fuentes/zernio";
import { recolectar, type Resumen, type ResumenCorrida } from "./recolectar";

const PAGE = "1412423015288087";
const IG = "17841446002302741";
const SECRETO = "token-super-secreto-123";

const fixture = (nombre: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "pruebas/fixtures/api", `${nombre}.json`), "utf8")) as unknown;

const vacia = { posts: [], pagination: { page: 1, limit: 50, total: 0, pages: 0, nextCursor: null } };

/** fetch falso: responde con los fixtures según la ruta y cuenta las llamadas por fuente. */
function fetchFalso(cuenta: { zernio: number; meta: number }): typeof fetch {
  return async (entrada) => {
    const url = new URL(entrada instanceof Request ? entrada.url : entrada.toString());
    let cuerpo: unknown;
    if (url.hostname === "zernio.com") {
      cuenta.zernio += 1;
      const ruta = url.pathname.replace("/api/v1", "");
      if (ruta === "/accounts/follower-stats") cuerpo = fixture("zernio-follower-stats");
      else if (ruta === "/analytics") cuerpo = fixture("zernio-analytics");
      else if (ruta === "/posts") {
        const e = url.searchParams.get("status");
        cuerpo = e === "draft" || e === "scheduled" ? fixture(`zernio-posts-${e}`) : vacia;
      } else throw new Error(`ruta de Zernio sin fixture: ${ruta}`);
    } else {
      cuenta.meta += 1;
      const [, , id, sub] = url.pathname.split("/");
      if (sub === "video_reels") cuerpo = fixture("meta-fb-reels");
      else if (sub === "media") cuerpo = fixture("meta-ig-media");
      else if (sub === "video_insights") cuerpo = fixture("meta-fb-insights-todas");
      else if (sub === "insights") cuerpo = fixture("meta-ig-insights-todas");
      else if (id === PAGE) cuerpo = fixture("meta-fb-pagina");
      else if (id === IG) cuerpo = fixture("meta-ig-cuenta");
      else throw new Error(`ruta de Meta sin fixture: ${url.pathname}`);
    }
    return new Response(JSON.stringify(cuerpo), { status: 200, headers: { "content-type": "application/json" } });
  };
}

function clientes() {
  const llamadas = { zernio: 0, meta: 0 };
  const f = fetchFalso(llamadas);
  return {
    llamadas,
    zernio: crearZernio({ apiKey: "zernio-llave-falsa", fetch: f }),
    meta: crearMeta({ token: SECRETO, pageId: PAGE, igUserId: IG, fetch: f }),
  };
}

const falla = (): Promise<never> => Promise.reject(new ErrorFuente(`HTTP 500: ${SECRETO} caído`));
const metaQueFalla: ClienteMeta = {
  reelsFacebook: falla,
  mediaInstagram: falla,
  metricas: falla,
  cuentaFacebook: falla,
  cuentaInstagram: falla,
};
const zernioQueFalla: ClienteZernio = {
  cuentas: falla,
  analitica: falla,
  posts: falla,
  post: falla,
  historial: falla,
  seguidores: falla,
};

const AHORA = new Date("2026-11-07T12:00:00Z"); // 07:00 en Bogotá
const UNA_HORA = 3_600_000;

interface Extra {
  ahora?: Date;
  presupuestoMs?: number;
  meta?: ClienteMeta;
}

const corre = (c: ReturnType<typeof clientes>, extra: Extra = {}): Promise<Resumen> => {
  const ahora = extra.ahora ?? AHORA;
  return recolectar(bd(), {
    zernio: c.zernio,
    meta: extra.meta ?? c.meta,
    ahora: () => ahora,
    ...(extra.presupuestoMs !== undefined ? { presupuestoMs: extra.presupuestoMs } : {}),
    origen: "cli",
    secretos: [SECRETO],
  });
};

function conCorrida(r: Resumen): ResumenCorrida {
  if (r.estado === "ocupado") throw new Error("la corrida salió ocupada");
  return r;
}

describe.skipIf(!hayBd)("recolector", () => {
  const db = bd();
  beforeEach(async () => {
    await vaciar(db);
    await db.insert(reel).values([{ id: "13" }, { id: "14" }, { id: "21" }]);
  });
  afterAll(cerrarBd);

  it("la primera corrida crea publicaciones y lecturas; la segunda con los mismos datos no crea lecturas", async () => {
    const c = clientes();
    const a = conCorrida(await corre(c));
    expect(a.estado).toBe("ok");
    expect(a.publicacionesNuevas).toBeGreaterThan(0);
    expect(a.lecturasNuevas).toBeGreaterThan(0);
    expect(a.pendientes).toBe(0);
    console.log("llamadas en la primera corrida:", c.llamadas);
    const ls = await db.select().from(lectura);
    expect(new Set(ls.map((l) => l.fuente))).toEqual(new Set(["zernio", "meta"]));
    const [fila] = await db.select().from(corrida).where(eq(corrida.id, a.corridaId));
    expect(fila?.estado).toBe("ok");
    expect(fila?.terminadaEn).not.toBeNull();

    const antes = ls.length;
    const pubs = (await db.select().from(publicacion)).length;
    const c2 = clientes();
    const b = conCorrida(await corre(c2, { ahora: new Date(AHORA.getTime() + UNA_HORA) }));
    expect(b.lecturasNuevas).toBe(0);
    expect(b.lecturasRepetidas).toBeGreaterThan(0);
    expect(b.publicacionesNuevas).toBe(0);
    expect((await db.select().from(lectura)).length).toBe(antes);
    expect((await db.select().from(publicacion)).length).toBe(pubs);
    console.log("llamadas en la segunda corrida (a Meta todavía no le toca leer):", c2.llamadas);
  });

  it("si Meta falla, abre alertas sin llaves, guarda lo de Zernio y la corrida queda parcial", async () => {
    const c = clientes();
    const r = conCorrida(await corre(c, { meta: metaQueFalla }));
    expect(r.estado).toBe("parcial");
    expect(r.errores.join(" ")).not.toContain(SECRETO);
    const abiertas = await db.select().from(alerta).where(isNull(alerta.resueltaEn));
    const claves = abiertas.map((a) => a.clave);
    expect(claves).toContain("fuente:meta:cuentas");
    expect(claves).toContain("fuente:meta:reels-facebook");
    expect(claves).toContain("fuente:meta:media-instagram");
    expect(abiertas.map((a) => a.mensaje).join(" ")).not.toContain(SECRETO);
    expect((await db.select().from(lectura).where(eq(lectura.fuente, "zernio"))).length).toBeGreaterThan(0);
    expect((await db.select().from(lectura).where(eq(lectura.fuente, "meta"))).length).toBe(0);

    // Cuando Meta vuelve, las alertas de la fuente se cierran.
    const r2 = conCorrida(await corre(c, { ahora: new Date(AHORA.getTime() + UNA_HORA) }));
    expect(r2.estado).toBe("ok");
    const deFuente = (await db.select().from(alerta).where(isNull(alerta.resueltaEn))).filter((a) =>
      a.clave.startsWith("fuente:"),
    );
    expect(deFuente).toEqual([]);
  });

  it("si todo falla, la corrida queda en error", async () => {
    const r = conCorrida(
      await recolectar(db, { zernio: zernioQueFalla, meta: metaQueFalla, ahora: () => AHORA, origen: "http", secretos: [SECRETO] }),
    );
    expect(r.estado).toBe("error");
    expect(r.errores.join(" ")).not.toContain(SECRETO);
  });

  it("una corrida en curso reciente da ocupado; una de hace más de 10 minutos se abandona", async () => {
    await db.insert(corrida).values({ origen: "cli", estado: "en_curso", iniciadaEn: AHORA });
    const c = clientes();
    expect(await corre(c)).toEqual({ estado: "ocupado" });
    expect(c.llamadas).toEqual({ zernio: 0, meta: 0 });
    expect((await db.select().from(publicacion)).length).toBe(0);

    await vaciar(db);
    await db.insert(corrida).values({ origen: "cli", estado: "en_curso", iniciadaEn: new Date(AHORA.getTime() - 11 * 60_000) });
    const r = conCorrida(await corre(c));
    expect(r.estado).toBe("ok");
    const estados = (await db.select().from(corrida)).map((f) => f.estado).sort();
    expect(estados).toEqual(["abandonada", "ok"]);
  });

  it("con presupuesto 0 queda parcial, con pendientes y sin lecturas de Meta", async () => {
    const r = conCorrida(await corre(clientes(), { presupuestoMs: 0 }));
    expect(r.estado).toBe("parcial");
    expect(r.pendientes).toBe(19); // 11 reels de Facebook y 8 de Instagram
    expect((await db.select().from(lectura).where(eq(lectura.fuente, "meta"))).length).toBe(0);
    expect((await db.select().from(lectura).where(eq(lectura.fuente, "zernio"))).length).toBeGreaterThan(0);
  });

  it("un borrador que sale en menos de 24 h abre su alerta, y se cierra cuando ya no aplica", async () => {
    // Los borradores del reel 13 salen el 7-nov a las 19:30 de Bogotá.
    const c = clientes();
    conCorrida(await corre(c));
    const abiertas = await db.select().from(alerta).where(isNull(alerta.resueltaEn));
    const sinProgramar = abiertas.filter((a) => a.clave.endsWith(":sin-programar"));
    expect(sinProgramar.length).toBe(2); // TikTok e Instagram
    const tiktok = sinProgramar.find((a) => a.mensaje.includes("TikTok"));
    expect(tiktok?.mensaje).toBe("El 13 sigue en borrador en TikTok y sale hoy a las 19:30");
    expect(tiktok?.reelId).toBe("13");

    // Dos semanas después los borradores siguen en la cola de Zernio, pero ya no están cerca: se cierran.
    conCorrida(await corre(c, { ahora: new Date("2026-11-21T12:00:00Z") }));
    const siguen = (await db.select().from(alerta).where(isNull(alerta.resueltaEn))).filter((a) =>
      a.clave.startsWith("cola:"),
    );
    expect(siguen).toEqual([]);
  });
});
