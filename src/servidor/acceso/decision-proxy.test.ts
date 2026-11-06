import { describe, expect, it } from "vitest";
import { decidirProxy, rutaPublica } from "./decision-proxy";

const ORIGEN = "https://insights.btw-one.com";
const p = (ruta: string, extra: Partial<Parameters<typeof decidirProxy>[0]> = {}) =>
  decidirProxy({ ruta, tieneCookie: false, produccion: true, origen: ORIGEN, ...extra });

describe("rutaPublica", () => {
  it.each(["/entrar", "/registrar", "/api/salud", "/api/recolectar", "/api/acceso/entrada/opciones", "/api/exportar/metricas.csv", "/api/exportar/metricas", "/_next/static/x.js", "/favicon.ico", "/logo.png"])(
    "%s es pública",
    (r) => expect(rutaPublica(r)).toBe(true),
  );
  it.each(["/", "/hoy", "/videos/14", "/cola", "/api/otra", "/entrarx", "/api/saludo"])("%s es privada", (r) =>
    expect(rutaPublica(r)).toBe(false),
  );
});

describe("decidirProxy", () => {
  it("en desarrollo deja pasar todo", () => {
    expect(p("/hoy", { produccion: false, origen: undefined })).toEqual({ tipo: "pasar" });
  });
  it("sin cookie, una página redirige a /entrar con el origen configurado", () => {
    expect(p("/hoy")).toEqual({ tipo: "redirigir", url: `${ORIGEN}/entrar` });
  });
  it("sin cookie, una ruta privada de la API da 401", () => {
    expect(p("/api/otra")).toEqual({ tipo: "no_autorizado" });
  });
  it("con cookie pasa (la validación real es de exigirSesion)", () => {
    expect(p("/hoy", { tieneCookie: true })).toEqual({ tipo: "pasar" });
  });
  it("las rutas públicas pasan sin cookie", () => {
    expect(p("/entrar")).toEqual({ tipo: "pasar" });
    expect(p("/api/recolectar")).toEqual({ tipo: "pasar" });
  });
  it("en producción sin origen configurado niega (falla cerrado)", () => {
    expect(p("/hoy", { origen: undefined })).toEqual({ tipo: "negar" });
  });
});
