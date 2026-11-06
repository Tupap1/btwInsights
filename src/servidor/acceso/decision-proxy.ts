// Decisión del proxy como función pura (sin Next), para probarla. La revisión real de la sesión es de exigirSesion().

const EXACTAS = ["/entrar", "/registrar", "/api/salud", "/api/recolectar", "/favicon.ico"];
const PREFIJOS = ["/api/acceso/", "/_next/"];

export function rutaPublica(ruta: string): boolean {
  if (EXACTAS.includes(ruta)) return true;
  if (PREFIJOS.some((p) => ruta.startsWith(p))) return true;
  // Archivos con extensión (imágenes, íconos...).
  return /\.[A-Za-z0-9]+$/.test(ruta.split("/").pop() ?? "");
}

export type DecisionProxy =
  | { tipo: "pasar" }
  | { tipo: "redirigir"; url: string }
  | { tipo: "no_autorizado" }
  | { tipo: "negar" };

export function decidirProxy(e: {
  ruta: string;
  tieneCookie: boolean;
  produccion: boolean;
  origen: string | undefined;
}): DecisionProxy {
  if (!e.produccion) return { tipo: "pasar" };
  if (rutaPublica(e.ruta)) return { tipo: "pasar" };
  if (e.tieneCookie) return { tipo: "pasar" };
  // Detrás de Nginx Proxy Manager el Host es interno: la redirección sale de WEBAUTHN_ORIGEN.
  if (!e.origen) return { tipo: "negar" };
  if (e.ruta.startsWith("/api/")) return { tipo: "no_autorizado" };
  return { tipo: "redirigir", url: `${e.origen.replace(/\/$/, "")}/entrar` };
}
