// Arma los clientes de Zernio y Meta desde la configuración, solo si están sus variables.
import "server-only";
import { config, secretos as secretosDeConfig } from "../config";
import { crearMeta, type ClienteMeta } from "../fuentes/meta";
import { crearZernio, type ClienteZernio } from "../fuentes/zernio";

export interface Clientes {
  zernio?: ClienteZernio;
  meta?: ClienteMeta;
}

export function clientes(): Clientes {
  const c = config();
  const salida: Clientes = {};
  if (c.ZERNIO_API_KEY) salida.zernio = crearZernio({ apiKey: c.ZERNIO_API_KEY });
  if (c.META_PAGE_TOKEN && c.META_PAGE_ID && c.IG_USER_ID) {
    salida.meta = crearMeta({
      token: c.META_PAGE_TOKEN,
      pageId: c.META_PAGE_ID,
      igUserId: c.IG_USER_ID,
      version: c.GRAPH_VERSION,
    });
  }
  return salida;
}

/** Valores que nunca deben salir en un mensaje (llaves y secreto del recolector). */
export function secretos(): string[] {
  return secretosDeConfig();
}
