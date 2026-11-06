// Graba respuestas reales de Zernio para la fase 3 (solo GET): el inbox de comentarios.
// No toca los fixtures de las fases 1 y 2 (para eso está grabar-fixtures.ts).
// Datos de personas (regla 3.6): en el fixture no queda nadie que no sea la propia cuenta. De quien comenta se
// reemplazan el nombre, el @, el id, la foto, el enlace y el texto. Las imágenes firmadas de los CDN tampoco se guardan.
// Nunca imprime URLs ni llaves. Uso: npm run grabar-fixtures:fase3
import { mkdirSync, writeFileSync } from "node:fs";

const env = process.env;
const DIR = "pruebas/fixtures/api";
const BASE = "https://zernio.com/api/v1";
const secretos = [env.ZERNIO_API_KEY].filter((v): v is string => !!v && v.length >= 8);

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };
const objeto = (j: Json | undefined): Obj => (j && typeof j === "object" && !Array.isArray(j) ? j : {});
const lista = (j: Json | undefined): Json[] => (Array.isArray(j) ? j : []);

function sinSecretos(texto: string): string {
  let t = texto;
  for (const s of secretos) t = t.split(s).join("<redactado>");
  return t;
}

function guardar(nombre: string, datos: Json): void {
  const texto = JSON.stringify(datos, null, 2);
  if (secretos.some((s) => texto.includes(s))) throw new Error(`${nombre}: la respuesta contenía una llave; no se guardó.`);
  writeFileSync(`${DIR}/${nombre}.json`, texto + "\n", "utf8");
  console.log(`grabado ${nombre}.json`);
}

async function pedir(ruta: string, params: Record<string, string> = {}): Promise<Json> {
  const url = new URL(`${BASE}${ruta}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${env.ZERNIO_API_KEY}` } });
  const json = (await r.json().catch(() => ({}))) as Json;
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${ruta}: ${sinSecretos(JSON.stringify(json)).slice(0, 200)}`);
  return json;
}

/** Las URLs de imagen de Instagram y TikTok van firmadas y vencen: no se guardan. */
const IMAGEN = /^(picture|thumbnailUrl|mediaUrl)$/;

/** Una fila de GET /inbox/comments: todo es de la propia cuenta salvo las imágenes. */
function limpiarFila(f: Json): Json {
  const o = { ...objeto(f) };
  for (const k of Object.keys(o)) if (IMAGEN.test(k)) o[k] = o[k] === null ? null : "<imagen>";
  return o;
}

let otros = 0;
const alias = new Map<string, number>();

/** Un comentario: si no es de la cuenta, se reemplaza todo lo que identifica a la persona y su texto. */
function limpiarComentario(c: Json): Json {
  const o = { ...objeto(c) };
  const de = { ...objeto(o["from"]) };
  if (de["isOwner"] === true) {
    de["picture"] = null;
  } else {
    const clave = String(de["id"] ?? de["username"] ?? Math.random());
    if (!alias.has(clave)) alias.set(clave, alias.size + 1);
    const n = alias.get(clave);
    otros += 1;
    de["id"] = `<id-${n}>`;
    de["name"] = `<nombre-${n}>`;
    de["username"] = `usuario_${n}`;
    de["picture"] = null;
    o["message"] = `Comentario de prueba ${otros}`;
    if (typeof o["url"] === "string") o["url"] = "<enlace>";
    if ("attachment" in o) o["attachment"] = null;
  }
  o["from"] = de;
  if (Array.isArray(o["replies"])) o["replies"] = o["replies"].map(limpiarComentario);
  return o;
}

function limpiarHilo(h: Json): Json {
  const o = { ...objeto(h) };
  o["comments"] = lista(o["comments"]).map(limpiarComentario);
  if (o["post"] && typeof o["post"] === "object") {
    const p = { ...objeto(o["post"]) };
    for (const k of Object.keys(p)) if (IMAGEN.test(k)) p[k] = p[k] === null ? null : "<imagen>";
    o["post"] = p;
  }
  if ("comment" in o && o["comment"]) o["comment"] = limpiarComentario(o["comment"]);
  return o;
}

async function main(): Promise<void> {
  if (!env.ZERNIO_API_KEY) throw new Error("Falta ZERNIO_API_KEY.");
  mkdirSync(DIR, { recursive: true });

  const inbox = objeto(await pedir("/inbox/comments", { limit: "50" }));
  const filas = lista(inbox["data"]);
  guardar("zernio-inbox-comments", { ...inbox, data: filas.map(limpiarFila) });

  // Un hilo por red: el que más comentarios tenga.
  for (const red of ["instagram", "tiktok"]) {
    const conComentarios = filas
      .map(objeto)
      .filter((f) => f["platform"] === red && Number(f["commentCount"]) > 0)
      .sort((a, b) => Number(b["commentCount"]) - Number(a["commentCount"]));
    const f = conComentarios[0];
    if (!f) {
      console.log(`sin hilo de ${red}: ningún post con comentarios`);
      continue;
    }
    const hilo = await pedir(`/inbox/comments/${encodeURIComponent(String(f["id"]))}`, {
      accountId: String(f["accountId"]),
      limit: "100",
    });
    guardar(`zernio-inbox-hilo-${red}`, limpiarHilo(hilo));
  }

  console.log(`comentarios de otras personas anonimizados: ${otros} (de ${alias.size} personas)`);
}

main().catch((e: unknown) => {
  console.error(sinSecretos(e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
