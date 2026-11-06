// La ruta GET /api/exportar/metricas.csv con la base de pruebas: 401 sin secreto o con uno malo, 200 con el bueno.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hayBd, vaciar } from "../../../../../pruebas/bd";
import { bd, cerrarBd } from "@/servidor/db/cliente";
import { importar } from "@/servidor/importar/a-la-base";

const SECRETO = "secreto-de-prueba-0123456789";

describe.skipIf(!hayBd)("GET /api/exportar/metricas.csv", () => {
  let GET: (r: Request) => Promise<Response>;
  const pedir = (cabecera?: string) =>
    GET(new Request("http://localhost/api/exportar/metricas.csv", cabecera ? { headers: { authorization: cabecera } } : {}));

  beforeAll(async () => {
    process.env.RECOLECTOR_SECRETO = SECRETO;
    await vaciar(bd());
    await importar(bd(), "pruebas/fixtures/btw-videos");
    ({ GET } = await import("./route"));
  });
  afterAll(cerrarBd);

  it("sin secreto o con uno malo responde 401 sin detalles", async () => {
    for (const cab of [undefined, "Bearer malo", "Basic abc"]) {
      const r = await pedir(cab);
      expect(r.status).toBe(401);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(await r.text()).toBe("no autorizado");
    }
  });

  it("con el secreto responde el CSV como descarga", async () => {
    const r = await pedir(`Bearer ${SECRETO}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="metricas.csv"');
    expect(r.headers.get("cache-control")).toBe("no-store");
    const csv = await r.text();
    expect(csv.startsWith("reel,red,cuenta,estado,enlace,publicadoEn,fuente,via,")).toBe(true);
    expect(csv.split("\r\n").length).toBeGreaterThan(2);
    expect(csv).not.toContain(SECRETO);
  });
});
