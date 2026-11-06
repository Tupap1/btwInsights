// Graba respuestas reales de Zernio y Meta (solo GET) en pruebas/fixtures/api/ para que las pruebas usen la forma
// real de los datos sin llamar a las APIs. Antes de escribir:
//   - quita "paging" (Meta mete el token en esas URLs) y cualquier campo con token, secret o password en el nombre;
//   - reemplaza correos por "<correo>";
//   - si el texto final contiene el valor de una llave, no escribe nada y termina con error.
// Nunca imprime URLs ni llaves. Uso: npm run grabar-fixtures
import { mkdirSync, writeFileSync } from "node:fs";

const env = process.env;
const DIR = "pruebas/fixtures/api";
const secretos = [env.META_PAGE_TOKEN, env.ZERNIO_API_KEY].filter((v): v is string => !!v && v.length >= 8);
const grabadas: string[] = [];
const fallos: string[] = [];

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function limpiar(x: Json): Json {
  if (Array.isArray(x)) return x.map(limpiar);
  if (x && typeof x === "object") {
    const fuera: { [k: string]: Json } = {};
    for (const [k, v] of Object.entries(x)) {
      if (k === "paging") continue;
      fuera[k] = /token|secret|password|credential|cookie|authorization/i.test(k) ? "<redactado>" : limpiar(v);
    }
    return fuera;
  }
  if (typeof x === "string") return x.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<correo>");
  return x;
}

function sinSecretos(texto: string): string {
  let t = texto;
  for (const s of secretos) t = t.split(s).join("<redactado>");
  return t;
}

function guardar(nombre: string, datos: Json): void {
  const texto = JSON.stringify(limpiar(datos), null, 2);
  if (secretos.some((s) => texto.includes(s))) throw new Error(`${nombre}: la respuesta contenía una llave; no se guardó.`);
  writeFileSync(`${DIR}/${nombre}.json`, texto + "\n", "utf8");
  grabadas.push(nombre);
}

async function pedir(url: URL, cabeceras: Record<string, string> = {}): Promise<{ status: number; json: Json }> {
  const r = await fetch(url, { headers: cabeceras });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, json };
}

async function paso(nombre: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    fallos.push(`${nombre}: ${sinSecretos(e instanceof Error ? e.message : String(e)).slice(0, 200)}`);
  }
}

const objeto = (j: Json): { [k: string]: Json } => (j && typeof j === "object" && !Array.isArray(j) ? j : {});
const lista = (j: Json | undefined): Json[] => (Array.isArray(j) ? j : []);

mkdirSync(DIR, { recursive: true });

// Modo `--solo post-timeline`: graba únicamente el historial diario del post de Zernio publicado hace más días (de los
// que trae /analytics) en zernio-post-timeline-varios-dias.json, sin tocar los demás fixtures.
const soloTimeline = process.argv.includes("--solo") && process.argv[process.argv.indexOf("--solo") + 1] === "post-timeline";
if (soloTimeline) {
  if (!env.ZERNIO_API_KEY) fallos.push("Zernio: falta ZERNIO_API_KEY.");
  else {
    const auth = { Authorization: `Bearer ${env.ZERNIO_API_KEY}` };
    const z = (ruta: string, params: Record<string, string>) => {
      const u = new URL(`https://zernio.com/api/v1${ruta}`);
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
      return pedir(u, auth);
    };
    await paso("zernio-post-timeline-varios-dias", async () => {
      const r = await z("/analytics", { limit: "100", page: "1" });
      const posts = lista(objeto(r.json).posts)
        .map(objeto)
        .filter((p) => typeof p._id === "string" && typeof p.publishedAt === "string")
        .sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)));
      const viejo = posts[0];
      if (!viejo || typeof viejo._id !== "string") throw new Error("no hubo post con fecha de publicación en analytics");
      guardar("zernio-post-timeline-varios-dias", (await z("/analytics/post-timeline", { postId: viejo._id })).json);
    });
  }
  console.log(`Grabadas (${grabadas.length}): ${grabadas.join(", ")}`);
  for (const f of fallos) console.log(`Falló: ${f}`);
  process.exit(fallos.length ? 1 : 0);
}

// ---------- Zernio ----------
if (env.ZERNIO_API_KEY) {
  const Z = "https://zernio.com/api/v1";
  const auth = { Authorization: `Bearer ${env.ZERNIO_API_KEY}` };
  const z = async (ruta: string, params: Record<string, string> = {}) => {
    const u = new URL(`${Z}${ruta}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return pedir(u, auth);
  };
  let idAnalitica: string | undefined;
  let idBorrador: string | undefined;

  await paso("zernio-accounts", async () => guardar("zernio-accounts", (await z("/accounts")).json));
  await paso("zernio-analytics", async () => {
    const r = await z("/analytics", { limit: "100", page: "1" });
    guardar("zernio-analytics", r.json);
    const post = objeto(lista(objeto(r.json).posts)[0] ?? null);
    idAnalitica = typeof post._id === "string" ? post._id : undefined;
  });
  for (const estado of ["draft", "scheduled", "published", "failed"]) {
    await paso(`zernio-posts-${estado}`, async () => {
      const r = await z("/posts", { status: estado, limit: "50" });
      guardar(`zernio-posts-${estado}`, r.json);
      if (estado === "draft") {
        const p = objeto(lista(objeto(r.json).posts)[0] ?? null);
        idBorrador = typeof p._id === "string" ? p._id : undefined;
      }
    });
  }
  await paso("zernio-post-detalle", async () => {
    if (!idBorrador) throw new Error("no hubo borrador para leer en detalle");
    guardar("zernio-post-detalle", (await z(`/posts/${idBorrador}`)).json);
  });
  await paso("zernio-post-timeline", async () => {
    if (!idAnalitica) throw new Error("no hubo post en analytics para pedir su timeline");
    guardar("zernio-post-timeline", (await z("/analytics/post-timeline", { postId: idAnalitica })).json);
  });
  await paso("zernio-follower-stats", async () => guardar("zernio-follower-stats", (await z("/accounts/follower-stats")).json));
} else fallos.push("Zernio: falta ZERNIO_API_KEY.");

// ---------- Meta ----------
if (env.META_PAGE_TOKEN && env.META_PAGE_ID && env.IG_USER_ID) {
  const G = `https://graph.facebook.com/${env.GRAPH_VERSION ?? "v25.0"}`;
  const token = env.META_PAGE_TOKEN;
  const g = async (ruta: string, params: Record<string, string> = {}) => {
    const u = new URL(`${G}/${ruta}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    u.searchParams.set("access_token", token);
    return pedir(u);
  };
  const FB = ["blue_reels_play_count", "fb_reels_total_plays", "post_video_avg_time_watched", "post_video_view_time", "total_video_complete_views", "post_video_social_actions", "post_video_likes_by_reaction_type"];
  const IGM = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time"];
  let reelFb: string | undefined;
  let mediaIg: string | undefined;

  await paso("meta-fb-pagina", async () => guardar("meta-fb-pagina", (await g(env.META_PAGE_ID!, { fields: "followers_count,fan_count" })).json));
  await paso("meta-fb-reels", async () => {
    const r = await g(`${env.META_PAGE_ID}/video_reels`, { fields: "id,description,created_time,permalink_url,length", limit: "50" });
    guardar("meta-fb-reels", r.json);
    const v = objeto(lista(objeto(r.json).data)[0] ?? null);
    reelFb = typeof v.id === "string" ? v.id : undefined;
  });
  if (reelFb) {
    await paso("meta-fb-insights-todas", async () => guardar("meta-fb-insights-todas", (await g(`${reelFb}/video_insights`, { metric: FB.join(",") })).json));
    for (const m of FB) await paso(`meta-fb-insight-${m}`, async () => guardar(`meta-fb-insight-${m}`, (await g(`${reelFb}/video_insights`, { metric: m })).json));
    await paso("meta-fb-insight-error", async () => guardar("meta-fb-insight-error", (await g(`${reelFb}/video_insights`, { metric: "metrica_que_no_existe" })).json));
  }
  await paso("meta-ig-cuenta", async () => guardar("meta-ig-cuenta", (await g(env.IG_USER_ID!, { fields: "followers_count,media_count" })).json));
  await paso("meta-ig-media", async () => {
    const r = await g(`${env.IG_USER_ID}/media`, { fields: "id,caption,media_product_type,timestamp,permalink", limit: "50" });
    guardar("meta-ig-media", r.json);
    const reels = lista(objeto(r.json).data).map(objeto).filter((p) => p.media_product_type === "REELS");
    mediaIg = typeof reels[0]?.id === "string" ? reels[0].id : undefined;
  });
  if (mediaIg) {
    await paso("meta-ig-insights-todas", async () => guardar("meta-ig-insights-todas", (await g(`${mediaIg}/insights`, { metric: IGM.join(",") })).json));
    for (const m of IGM) await paso(`meta-ig-insight-${m}`, async () => guardar(`meta-ig-insight-${m}`, (await g(`${mediaIg}/insights`, { metric: m })).json));
    await paso("meta-ig-insight-error", async () => guardar("meta-ig-insight-error", (await g(`${mediaIg}/insights`, { metric: "metrica_que_no_existe" })).json));
  }
} else fallos.push("Meta: faltan META_PAGE_TOKEN, META_PAGE_ID o IG_USER_ID.");

console.log(`Grabadas (${grabadas.length}): ${grabadas.join(", ")}`);
for (const f of fallos) console.log(`Falló: ${f}`);
process.exitCode = fallos.length ? 1 : 0;
