// Cliente HTTP mínimo: GET por defecto (PUT solo si el llamador lo pide con `escritura`), con reintentos y errores que nunca llevan la URL, las cabeceras ni las llaves.

export class ErrorFuente extends Error {
  readonly estado?: number;
  readonly codigo?: number;

  constructor(mensaje: string, datos: { estado?: number; codigo?: number } = {}) {
    super(mensaje);
    this.name = "ErrorFuente";
    if (datos.estado !== undefined) this.estado = datos.estado;
    if (datos.codigo !== undefined) this.codigo = datos.codigo;
  }
}

export interface OpcionesPedir {
  cabeceras?: Record<string, string>;
  /** Valores que jamás pueden salir en un mensaje (llaves, tokens). */
  secretos: readonly string[];
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  /** Reintentos después del primer intento. Por defecto 3. */
  intentos?: number;
  timeoutMs?: number;
  /**
   * Único camino a una escritura: un PUT con cuerpo JSON. Sin esto todo es GET. Una escritura no se reintenta
   * (ni 4xx ni 5xx ni red caída): el llamador decide si repetirla.
   */
  escritura?: { metodo: "PUT"; cuerpo: unknown };
}

/** Códigos de Meta que significan "espera y vuelve a intentar" (límite de uso o error temporal). */
const CODIGOS_META_REINTENTABLES: ReadonlySet<number> = new Set([4, 17, 32, 613]);
const BASE_ESPERA_MS = 500;

const esperarReal = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

export function redactar(texto: string, secretos: readonly string[]): string {
  let salida = texto;
  for (const secreto of secretos) {
    if (secreto.length > 0) salida = salida.split(secreto).join("<redactado>");
  }
  return salida;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Saca de un cuerpo de error de Meta el código y el mensaje, si los trae. */
function errorDeMeta(cuerpo: unknown): { codigo?: number; mensaje?: string } {
  if (!esObjeto(cuerpo)) return {};
  const e = cuerpo["error"];
  if (!esObjeto(e)) return {};
  const salida: { codigo?: number; mensaje?: string } = {};
  if (typeof e["code"] === "number") salida.codigo = e["code"];
  if (typeof e["message"] === "string") salida.mensaje = e["message"];
  return salida;
}

async function leerCuerpo(respuesta: Response): Promise<unknown> {
  const texto = await respuesta.text();
  if (texto.length === 0) return null;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return texto;
  }
}

function descripcionCorta(cuerpo: unknown): string | undefined {
  const meta = errorDeMeta(cuerpo);
  if (meta.mensaje) return meta.mensaje.slice(0, 300);
  if (esObjeto(cuerpo)) {
    for (const clave of ["error", "message", "detail"]) {
      const v = cuerpo[clave];
      if (typeof v === "string") return v.slice(0, 300);
    }
  }
  if (typeof cuerpo === "string") return cuerpo.slice(0, 300);
  return undefined;
}

export async function pedirJson(url: URL, op: OpcionesPedir): Promise<unknown> {
  const hacerFetch = op.fetch ?? fetch;
  const esperar = op.esperar ?? esperarReal;
  const reintentos = op.escritura ? 0 : (op.intentos ?? 3);
  const timeoutMs = op.timeoutMs ?? 15_000;
  const limpiar = (t: string) => redactar(t, op.secretos);

  let ultimo: ErrorFuente | undefined;
  for (let n = 0; n <= reintentos; n += 1) {
    if (n > 0) {
      await esperar(BASE_ESPERA_MS * 2 ** (n - 1) + Math.floor(Math.random() * 250));
    }
    let reintentable = false;
    try {
      const respuesta = await hacerFetch(url, {
        method: op.escritura ? op.escritura.metodo : "GET",
        headers: {
          Accept: "application/json",
          ...(op.escritura ? { "Content-Type": "application/json" } : {}),
          ...op.cabeceras,
        },
        ...(op.escritura ? { body: JSON.stringify(op.escritura.cuerpo) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const cuerpo = await leerCuerpo(respuesta);
      if (respuesta.ok) return cuerpo;

      const meta = errorDeMeta(cuerpo);
      const detalle = descripcionCorta(cuerpo);
      reintentable =
        respuesta.status === 429 ||
        (respuesta.status >= 500 && respuesta.status <= 504) ||
        (meta.codigo !== undefined && CODIGOS_META_REINTENTABLES.has(meta.codigo));
      const datos: { estado: number; codigo?: number } = { estado: respuesta.status };
      if (meta.codigo !== undefined) datos.codigo = meta.codigo;
      ultimo = new ErrorFuente(limpiar(`HTTP ${respuesta.status}${detalle ? `: ${detalle}` : ""}`), datos);
    } catch (e) {
      // Red caída o timeout: se reintenta. El mensaje original puede traer la URL, así que solo va el nombre.
      const nombre = e instanceof Error ? e.name : "Error";
      ultimo = new ErrorFuente(
        limpiar(nombre === "TimeoutError" ? "tiempo de espera agotado" : `error de red (${nombre})`),
      );
      reintentable = true;
    }
    if (!reintentable) break;
  }
  throw ultimo ?? new ErrorFuente("error desconocido");
}
