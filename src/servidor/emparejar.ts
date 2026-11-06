// Empareja publicaciones con reels. Lógica pura: no lee archivos ni llama a nadie.
// Orden de las reglas (docs/requisitos.md, sección 7): id guardado, etiqueta "reel-XX", fecha + texto (+ duración).
import type { PublicacionVista, ReelCandidato } from "./tipos";

export interface ContextoEmparejar {
  /** zernio_post_id → reelId */
  porZernioId: ReadonlyMap<string, string>;
  /** `${red}:${postIdPlataforma}` → reelId */
  porPostId: ReadonlyMap<string, string>;
  reels: readonly ReelCandidato[];
}

export type Resultado =
  | { reelId: string; por: "id" | "etiqueta" | "fecha_texto" }
  | { reelId: null; motivo: string; candidatos: string[] };

const LARGO_COMPARACION = 40;
const LARGO_MINIMO = 15;
const TOLERANCIA_DURACION_S = 0.6;
const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;
const MS_DIA = 24 * 60 * 60 * 1000;
const MOTIVO_MISMA_RED = "otra publicación de la misma red ya ocupa este reel";

/** Minúsculas, sin tildes, sin emojis ni signos, espacios simples, primeras 40 letras. */
export function normalizarTexto(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, LARGO_COMPARACION)
    .trim();
}

/** Día (AAAA-MM-DD) en America/Bogota, que es UTC-5 fijo. */
function diaBogota(fecha: Date): string {
  return new Date(fecha.getTime() - DESFASE_BOGOTA_MS).toISOString().slice(0, 10);
}

function numeroDeDia(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`) / MS_DIA;
}

function fechaDePublicacion(p: PublicacionVista): string | null {
  const f = p.publicadoEn ?? p.programadoPara;
  return f === null ? null : diaBogota(f);
}

function fechaCercana(reel: ReelCandidato, dia: string): boolean {
  const n = numeroDeDia(dia);
  return reel.fechas.some((f) => Math.abs(numeroDeDia(f) - n) <= 1);
}

function fechaExacta(reel: ReelCandidato, dia: string): boolean {
  return reel.fechas.includes(dia);
}

function textoCoincide(a: string, b: string): boolean {
  const corto = a.length <= b.length ? a : b;
  const largo = corto === a ? b : a;
  return corto.length >= LARGO_MINIMO && largo.startsWith(corto);
}

function algunTextoCoincide(reel: ReelCandidato, textoNormalizado: string): boolean {
  return reel.textos.some((t) => textoCoincide(textoNormalizado, normalizarTexto(t)));
}

function duracionCompatible(p: PublicacionVista, reel: ReelCandidato): boolean {
  const d = p.duracionS;
  return d !== null && reel.duracionesS.some((x) => Math.abs(d - x) <= TOLERANCIA_DURACION_S);
}

function sinMatch(motivo: string, candidatos: readonly ReelCandidato[]): Resultado {
  return { reelId: null, motivo, candidatos: candidatos.map((r) => r.id) };
}

export function emparejar(p: PublicacionVista, ctx: ContextoEmparejar): Resultado {
  // 1. Por id guardado.
  if (p.zernioPostId !== null) {
    const id = ctx.porZernioId.get(p.zernioPostId);
    if (id !== undefined) return { reelId: id, por: "id" };
  }
  if (p.postIdPlataforma !== null) {
    const id = ctx.porPostId.get(`${p.red}:${p.postIdPlataforma}`);
    if (id !== undefined) return { reelId: id, por: "id" };
  }

  // 2. Por etiqueta "reel-XX".
  for (const etiqueta of p.etiquetas) {
    const m = /^reel-(.+)$/iu.exec(etiqueta.trim());
    if (m?.[1] === undefined) continue;
    const buscado = m[1].toLowerCase();
    const reel = ctx.reels.find((r) => r.id.toLowerCase() === buscado);
    if (reel !== undefined) return { reelId: reel.id, por: "etiqueta" };
  }

  // 3. Por fecha (±1 día) y texto.
  const dia = fechaDePublicacion(p);
  if (dia === null) return sinMatch("la publicación no trae fecha", []);
  const porFecha = ctx.reels.filter((r) => fechaCercana(r, dia));
  const textoPost = p.texto === null ? "" : normalizarTexto(p.texto);
  if (textoPost === "") return sinMatch("la publicación no trae texto", porFecha);

  const candidatos = porFecha.filter((r) => algunTextoCoincide(r, textoPost));
  if (candidatos.length === 1 && candidatos[0] !== undefined) {
    return { reelId: candidatos[0].id, por: "fecha_texto" };
  }
  if (candidatos.length === 0) {
    return sinMatch("ningún reel tiene fecha cercana y texto parecido", porFecha);
  }
  const porDuracion = candidatos.filter((r) => duracionCompatible(p, r));
  if (porDuracion.length === 1 && porDuracion[0] !== undefined) {
    return { reelId: porDuracion[0].id, por: "fecha_texto" };
  }
  return sinMatch("varios reels coinciden en fecha y texto y la duración no desempata", candidatos);
}

/** Empareja en lote, en el mismo orden. Un reel solo lo ocupa una publicación "fecha_texto" por red. */
/** Estados en que una publicación ya está en la red (un borrador no ocupa el reel). */
export const ESTADOS_PUBLICADOS: ReadonlySet<PublicacionVista["estado"]> = new Set(["publicado", "parcial", "publicando"]);

export function emparejarLote(ps: readonly PublicacionVista[], ctx: ContextoEmparejar): Resultado[] {
  const resultados = ps.map((p) => emparejar(p, ctx));
  const reelsPorId = new Map(ctx.reels.map((r) => [r.id, r]));

  // Un post publicado que ya quedó en un reel por id o etiqueta ocupa ese reel en su red: un "fecha_texto" de la
  // misma red no puede caer ahí (caso real: el 04-G4 del 28-oct caía en el 04C-G1, cuyo post del 29 ya iba por id).
  const ocupados = new Set<string>();
  resultados.forEach((r, i) => {
    const p = ps[i];
    if (p && r.reelId !== null && r.por !== "fecha_texto" && ESTADOS_PUBLICADOS.has(p.estado)) ocupados.add(`${p.red}\u0000${r.reelId}`);
  });
  resultados.forEach((r, i) => {
    const p = ps[i];
    if (p && r.reelId !== null && r.por === "fecha_texto" && ocupados.has(`${p.red}\u0000${r.reelId}`)) {
      resultados[i] = { reelId: null, motivo: MOTIVO_MISMA_RED, candidatos: [r.reelId] };
    }
  });

  const grupos = new Map<string, number[]>();
  resultados.forEach((r, i) => {
    const p = ps[i];
    if (p === undefined || r.reelId === null || r.por !== "fecha_texto") return;
    const clave = `${p.red}\u0000${r.reelId}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), i]);
  });

  for (const indices of grupos.values()) {
    if (indices.length < 2) continue;
    const primero = resultados[indices[0] ?? 0];
    const reel = primero?.reelId == null ? undefined : reelsPorId.get(primero.reelId);
    if (reel === undefined) continue;

    const publicacion = (i: number): PublicacionVista => {
      const p = ps[i];
      if (p === undefined) throw new Error("índice fuera de rango");
      return p;
    };
    let vivos = indices;
    const exactas = vivos.filter((i) => {
      const dia = fechaDePublicacion(publicacion(i));
      return dia !== null && fechaExacta(reel, dia);
    });
    if (exactas.length > 0) vivos = exactas;
    if (vivos.length > 1) vivos = vivos.filter((i) => duracionCompatible(publicacion(i), reel));
    const ganadora = vivos.length === 1 ? vivos[0] : undefined;

    for (const i of indices) {
      if (i === ganadora) continue;
      resultados[i] = { reelId: null, motivo: MOTIVO_MISMA_RED, candidatos: [reel.id] };
    }
  }
  return resultados;
}
