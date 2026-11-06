import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import type { PublicacionVista, ReelCandidato, Red } from "./tipos";
import { emparejar, emparejarLote, normalizarTexto, type ContextoEmparejar, type Resultado } from "./emparejar";

// ---------- Datos reales (fixtures) ----------

const RAIZ = fileURLToPath(new URL("../../pruebas/fixtures/btw-videos/publicar/", import.meta.url));
type Fila = Record<string, string>;

function leerCsv(ruta: string): Fila[] {
  const filas: Fila[] = parse(readFileSync(RAIZ + ruta, "utf8"), { columns: true, bom: true, skip_empty_lines: true });
  return filas;
}

const ENCABEZADO = /^[A-ZÁÉÍÓÚÑ ]+( \(.*\))?$/u;

/** Las líneas de texto de un texto.txt: sin etiquetas (#), sin encabezados y sin las secciones de notas. */
function lineasDeTexto(ruta: string): string[] {
  const salida: string[] = [];
  for (const cruda of readFileSync(ruta, "utf8").split(/\r?\n/u)) {
    const linea = cruda.trim();
    if (linea === "COMENTARIO FIJADO" || linea === "ANTES DE PUBLICAR") break;
    if (linea === "" || linea.startsWith("#") || ENCABEZADO.test(linea)) continue;
    salida.push(linea);
  }
  return salida;
}

function armarPublicaciones(): PublicacionVista[] {
  return leerCsv("metricas/2026-11-05.csv").map((f) => ({
    red: f["red"] as Red,
    origen: "zernio",
    cuenta: null,
    postIdPlataforma: f["id"] ?? null,
    zernioPostId: null,
    etiquetas: [],
    enlace: f["enlace"] || null,
    texto: f["texto"] || null,
    duracionS: f["duracion_s"] ? Number(f["duracion_s"]) : null,
    programadoPara: null,
    publicadoEn: new Date(`${f["fecha"]}T${f["hora_utc"]}:00Z`),
    estado: "publicado",
  }));
}

function armarReels(): ReelCandidato[] {
  const reels = new Map<string, ReelCandidato>();
  const reel = (id: string): ReelCandidato => {
    let r = reels.get(id);
    if (r === undefined) {
      r = { id, fechas: [], textos: [], duracionesS: [] };
      reels.set(id, r);
    }
    return r;
  };
  const sumar = (lista: string[], valor: string): void => {
    if (valor !== "" && !lista.includes(valor)) lista.push(valor);
  };

  // 1. Calendario de Zernio: id y fecha de los borradores.
  const calendario = JSON.parse(readFileSync(RAIZ + "calendario-zernio.json", "utf8")) as {
    videos: { id: string; fecha: string }[];
  };
  for (const v of calendario.videos) sumar(reel(v.id).fechas, v.fecha);

  // 2. Seguimiento: fecha, gancho y, si trae "(43,3 s)", la duración. Ahí también se sabe si el cuerpo es dudoso.
  const cuerpoDudoso = new Set<string>();
  for (const f of leerCsv("seguimiento.csv")) {
    const r = reel(f["id"] ?? "");
    sumar(r.fechas, f["fecha"] ?? "");
    sumar(r.textos, f["gancho"] ?? "");
    const duracion = /\((\d+(?:,\d+)?) s\)/u.exec(f["cuerpo"] ?? "");
    if (duracion?.[1] !== undefined) r.duracionesS.push(Number(duracion[1].replace(",", ".")));
    if ((f["cuerpo"] ?? "").includes(" o ")) cuerpoDudoso.add(r.id);
  }

  // 3. Carpetas con fecha: AAAA-MM-DD_dia_ID_slug.
  const carpetas = readdirSync(RAIZ, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const c of carpetas) {
    const m = /^(\d{4}-\d{2}-\d{2})_[a-z]{3}_([^_]+)_/u.exec(c.name);
    if (m?.[1] === undefined || m[2] === undefined) continue;
    const r = reel(m[2]);
    sumar(r.fechas, m[1]);
    const ruta = `${RAIZ}${c.name}/texto.txt`;
    if (existsSync(ruta)) for (const l of lineasDeTexto(ruta)) sumar(r.textos, l);
  }

  // 4. _reserva/ID_slug_cuerpo-X: sin fecha en el nombre. Si el cuerpo publicado es dudoso (04-G4: "A o B"),
  // el texto de la carpeta no cuenta como el publicado.
  for (const c of readdirSync(RAIZ + "_reserva", { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const id = c.name.split("_")[0] ?? "";
    const r = reel(id);
    if (cuerpoDudoso.has(id)) continue;
    for (const l of lineasDeTexto(`${RAIZ}_reserva/${c.name}/texto.txt`)) sumar(r.textos, l);
  }
  return [...reels.values()].filter((r) => r.fechas.length > 0 || r.textos.length > 0);
}

function armarContexto(): ContextoEmparejar {
  const porZernioId = new Map(leerCsv("zernio-borradores.csv").map((f) => [f["post_id"] ?? "", f["id"] ?? ""]));
  return { porZernioId, porPostId: new Map(), reels: armarReels() };
}

const publicaciones = armarPublicaciones();
const ctx = armarContexto();

function buscar(red: Red, inicio: string, dia: string): { p: PublicacionVista; i: number } {
  const i = publicaciones.findIndex(
    (p) => p.red === red && p.texto?.startsWith(inicio) === true && p.publicadoEn?.toISOString().startsWith(dia) === true,
  );
  const p = publicaciones[i];
  if (p === undefined) throw new Error(`no hay publicación ${red} ${inicio} ${dia}`);
  return { p, i };
}

// ---------- Pruebas ----------

describe("normalizarTexto", () => {
  it("quita tildes y pasa a minúsculas", () => {
    expect(normalizarTexto("Cuánto Cuesta Montar")).toBe("cuanto cuesta montar");
  });
  it("quita emojis, signos de apertura y comillas", () => {
    expect(normalizarTexto("¿Cuánto te quedó hoy? 👇")).toBe("cuanto te quedo hoy");
    expect(normalizarTexto('"Mañana te pago." ¡Ya!')).toBe("manana te pago ya");
    expect(normalizarTexto("“Hola” – ‘mundo’ … $20")).toBe("hola mundo 20");
  });
  it("deja espacios simples y recorta", () => {
    expect(normalizarTexto("  uno \n\t dos   tres  ")).toBe("uno dos tres");
  });
  it("se queda con las primeras 40 letras", () => {
    const n = normalizarTexto("¿Cuánto cuesta montar un lavadero de carros en Colombia? Con 15 millones");
    expect(n).toBe("cuanto cuesta montar un lavadero de carr");
    expect(n).toHaveLength(40);
  });
  it("trata igual $20 y 20", () => {
    expect(normalizarTexto("Montaste tu lavadero con $20 millones.")).toBe(
      normalizarTexto("Montaste tu lavadero con 20 millones"),
    );
  });
});

describe("emparejar con datos reales", () => {
  it("arma las 28 publicaciones: 9 TikTok, 8 Instagram y 11 Facebook", () => {
    expect(publicaciones).toHaveLength(28);
    const cuenta = (r: Red): number => publicaciones.filter((p) => p.red === r).length;
    expect([cuenta("tiktok"), cuenta("instagram"), cuenta("facebook")]).toEqual([9, 8, 11]);
  });

  it("08: salió el 3-nov, su carpeta dice 7-nov y el seguimiento 3-nov", () => {
    expect(ctx.reels.find((r) => r.id === "08")?.fechas).toEqual(expect.arrayContaining(["2026-11-03", "2026-11-07"]));
    const lote = emparejarLote(publicaciones, ctx);
    for (const red of ["tiktok", "instagram", "facebook"] as const) {
      const { i } = buscar(red, "¿Cuánto cuesta montar", "2026-11-03");
      expect(lote[i]).toEqual({ reelId: "08", por: "fecha_texto" });
    }
  });

  it("10: 'Montaste tu lavadero con $20 millones' de TikTok del 5-nov", () => {
    const { i } = buscar("tiktok", "Montaste tu lavadero con $20", "2026-11-05");
    expect(emparejarLote(publicaciones, ctx)[i]).toEqual({ reelId: "10", por: "fecha_texto" });
  });

  it("'¿Cuánto te quedó hoy?': el del 29-oct es el 04C-G1 y el del 28-oct queda sin asignar, en cada red", () => {
    const lote = emparejarLote(publicaciones, ctx);
    for (const red of ["tiktok", "facebook"] as const) {
      expect(lote[buscar(red, "¿Cuánto te quedó hoy?", "2026-10-29").i]).toEqual({ reelId: "04C-G1", por: "fecha_texto" });
      expect(lote[buscar(red, "¿Cuánto te quedó hoy?", "2026-10-28").i]).toEqual({
        reelId: null,
        motivo: "otra publicación de la misma red ya ocupa este reel",
        candidatos: ["04C-G1"],
      });
    }
    // En Instagram solo hay uno (el del 29).
    expect(lote[buscar("instagram", "¿Cuánto te quedó hoy?", "2026-10-29").i]).toEqual({
      reelId: "04C-G1",
      por: "fecha_texto",
    });
  });

  it("sin el lote, el del 28-oct sí cae en 04C-G1 (fecha ±1 y texto)", () => {
    expect(emparejar(buscar("tiktok", "¿Cuánto te quedó hoy?", "2026-10-28").p, ctx)).toEqual({
      reelId: "04C-G1",
      por: "fecha_texto",
    });
  });

  it("los 28 posts: cada reel/red tiene a lo sumo una publicación", () => {
    const lote = emparejarLote(publicaciones, ctx);
    expect(lote).toHaveLength(28);
    const vistos = new Set<string>();
    lote.forEach((r, i) => {
      if (r.reelId === null) return;
      const clave = `${publicaciones[i]?.red}:${r.reelId}`;
      expect(vistos.has(clave)).toBe(false);
      vistos.add(clave);
    });
  });
});

describe("emparejar: reglas sueltas", () => {
  const reelA: ReelCandidato = { id: "A", fechas: ["2026-11-05"], textos: ["Texto de prueba largo uno"], duracionesS: [30] };
  const reelB: ReelCandidato = { id: "B", fechas: ["2026-11-06"], textos: ["Texto de prueba largo uno"], duracionesS: [45] };
  const reel09b: ReelCandidato = { id: "09b", fechas: ["2026-11-20"], textos: [], duracionesS: [] };
  const reels = [reelA, reelB, reel09b];
  const base: PublicacionVista = {
    red: "tiktok",
    origen: "zernio",
    cuenta: null,
    postIdPlataforma: "p1",
    zernioPostId: "z1",
    etiquetas: [],
    enlace: null,
    texto: "Texto de prueba largo uno y más",
    duracionS: 30.4,
    programadoPara: null,
    publicadoEn: new Date("2026-11-06T03:00:00Z"), // 5-nov 22:00 en Bogotá
    estado: "publicado",
  };
  const c = (extra: Partial<ContextoEmparejar> = {}): ContextoEmparejar => ({
    porZernioId: new Map(),
    porPostId: new Map(),
    reels,
    ...extra,
  });

  it("por id de Zernio y por id de plataforma", () => {
    expect(emparejar(base, c({ porZernioId: new Map([["z1", "B"]]) }))).toEqual({ reelId: "B", por: "id" });
    expect(emparejar(base, c({ porPostId: new Map([["tiktok:p1", "A"]]) }))).toEqual({ reelId: "A", por: "id" });
    const otraRed = emparejar(base, c({ porPostId: new Map([["facebook:p1", "B"]]) }));
    expect(otraRed).toEqual({ reelId: "A", por: "fecha_texto" });
  });

  it("por etiqueta reel-XX, con id en minúscula", () => {
    expect(emparejar({ ...base, etiquetas: ["otra", "reel-09b"] }, c())).toEqual({ reelId: "09b", por: "etiqueta" });
    expect(emparejar({ ...base, etiquetas: ["reel-99"] }, c())).toEqual({ reelId: "A", por: "fecha_texto" });
  });

  it("el día se cuenta en Bogotá: 03:00 UTC del 6 es el 5", () => {
    // Del 4 al 5 hay un día: coincide. Si se contara en UTC (6), serían dos.
    expect(emparejar(base, c({ reels: [{ ...reelA, fechas: ["2026-11-04"] }] }))).toEqual({
      reelId: "A",
      por: "fecha_texto",
    });
    expect(emparejar(base, c({ reels: [{ ...reelA, fechas: ["2026-11-03"] }] })).reelId).toBeNull();
  });

  it("usa programadoPara si no hay publicadoEn", () => {
    const p = { ...base, publicadoEn: null, programadoPara: new Date("2026-11-05T15:00:00Z") };
    expect(emparejar(p, c({ reels: [reelA] }))).toEqual({ reelId: "A", por: "fecha_texto" });
  });

  it("varios candidatos: desempata por duración (±0,6 s)", () => {
    const dosEn5 = [reelA, { ...reelB, fechas: ["2026-11-05"] }];
    expect(emparejar({ ...base, duracionS: 45.5 }, c({ reels: dosEn5 }))).toEqual({ reelId: "B", por: "fecha_texto" });
    const sin = emparejar({ ...base, duracionS: 38 }, c({ reels: dosEn5 }));
    expect(sin.reelId).toBeNull();
    if (sin.reelId === null) expect(sin.candidatos).toEqual(["A", "B"]);
  });

  it("texto corto (menos de 15) no coincide", () => {
    const corto = [{ ...reelA, textos: ["Hola mundo"] }];
    expect(emparejar({ ...base, texto: "Hola mundo y más cosas" }, c({ reels: corto })).reelId).toBeNull();
  });

  it("sin match: motivo legible y candidatos por fecha", () => {
    const r = emparejar({ ...base, texto: "Otra cosa que no se parece en nada" }, c());
    expect(r.reelId).toBeNull();
    if (r.reelId === null) {
      expect(r.motivo.length).toBeGreaterThan(10);
      expect(r.candidatos).toEqual(["A", "B"]);
    }
  });

  it("sin fecha ni texto no revienta", () => {
    expect(emparejar({ ...base, publicadoEn: null }, c()).reelId).toBeNull();
    expect(emparejar({ ...base, texto: null }, c()).reelId).toBeNull();
  });

  it("lote: id y etiqueta nunca se anulan, y ocupan el reel para un fecha_texto de la misma red", () => {
    const porEtiqueta = { ...base, postIdPlataforma: "p2", zernioPostId: null, etiquetas: ["reel-A"] };
    const porTexto = { ...base, postIdPlataforma: "p3", zernioPostId: null };
    const lote: Resultado[] = emparejarLote([porEtiqueta, porTexto], c({ reels: [reelA] }));
    expect(lote[0]).toEqual({ reelId: "A", por: "etiqueta" });
    expect(lote[1]?.reelId).toBeNull();
  });

  it("lote: gana el día exacto; si no, la duración compatible; si sigue el empate, nadie", () => {
    const mk = (id: string, utc: string, d: number): PublicacionVista => ({
      ...base,
      postIdPlataforma: id,
      zernioPostId: null,
      publicadoEn: new Date(utc),
      duracionS: d,
    });
    const contexto = c({ reels: [reelA] });

    const exacta = mk("a", "2026-11-05T20:00:00Z", 50);
    const vecina = mk("b", "2026-11-06T20:00:00Z", 30);
    const [r1, r2] = emparejarLote([vecina, exacta], contexto);
    expect(r1?.reelId).toBeNull();
    expect(r2).toEqual({ reelId: "A", por: "fecha_texto" });

    const v1 = mk("c", "2026-11-06T20:00:00Z", 30.1);
    const v2 = mk("d", "2026-11-04T20:00:00Z", 44);
    const [d1, d2] = emparejarLote([v2, v1], contexto);
    expect(d1?.reelId).toBeNull();
    expect(d2).toEqual({ reelId: "A", por: "fecha_texto" });

    const e1 = mk("e", "2026-11-06T20:00:00Z", 44);
    const e2 = mk("f", "2026-11-04T20:00:00Z", 44);
    expect(emparejarLote([e1, e2], contexto).map((r) => r.reelId)).toEqual([null, null]);
  });

  it("lote: redes distintas no se estorban", () => {
    const tt = { ...base, zernioPostId: null };
    const fb: PublicacionVista = { ...tt, red: "facebook", postIdPlataforma: "f1" };
    expect(emparejarLote([tt, fb], c({ reels: [reelA] })).map((r) => r.reelId)).toEqual(["A", "A"]);
  });
});
