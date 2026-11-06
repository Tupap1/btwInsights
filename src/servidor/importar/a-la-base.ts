// Pasa a la base todo lo que hay en btw-videos/publicar (seguimiento, calendario, carpetas, borradores y métricas).
// Se puede repetir sin duplicar: las publicaciones y las lecturas las escribe guardar.ts, y un reel que ya existe
// solo recibe los datos de las columnas que estén vacías (lo que Andrés editó después no se pisa).
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { eq, isNotNull } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { publicacion, reel } from "../db/esquema";
import { emparejarLote, type ContextoEmparejar } from "../emparejar";
import { guardarLectura, guardarPublicacion } from "../guardar";
import { cifrasVacias, type LecturaVista, type PublicacionVista, type ReelCandidato, type Red } from "../tipos";
import { leerBorradoresCsv } from "./borradores";
import { leerCalendario, type VideoCalendario } from "./calendario";
import { leerNombreCarpeta } from "./carpetas";
import { leerMetricasCsv } from "./metricas-csv";
import { leerSeguimiento, type FilaSeguimiento, type LecturaManual } from "./seguimiento";
import { leerTextoTxt, type TextoReel } from "./texto";

export interface SinAsignar {
  red: Red;
  /** AAAA-MM-DD en Bogotá, o null si la publicación no tiene fecha. */
  fecha: string | null;
  /** Primeras letras del texto. */
  texto: string;
}

export interface Informe {
  reelsCreados: number;
  reelsActualizados: number;
  publicacionesNuevas: number;
  publicacionesActualizadas: number;
  lecturasNuevas: number;
  lecturasRepetidas: number;
  /** Publicaciones que se unieron a su reel por fecha + texto (la regla), no por id ni etiqueta. */
  emparejadosPorRegla: number;
  sinAsignar: SinAsignar[];
  avisos: string[];
}

const NOTA_HORA_APROXIMADA =
  "La hora de lectura es aproximada: es la hora de modificación del archivo de métricas, no la de la consulta.";

type ReelNuevo = typeof reel.$inferInsert;
type FilaReel = typeof reel.$inferSelect;

async function leerSiExiste(ruta: string): Promise<string | null> {
  try {
    return await readFile(ruta, "utf8");
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return null;
    throw e;
  }
}

async function existeCarpeta(ruta: string): Promise<boolean> {
  try {
    return (await stat(ruta)).isDirectory();
  } catch {
    return false;
  }
}

/** Fecha (AAAA-MM-DD) en America/Bogota, que es UTC-5 fijo. */
function fechaBogota(d: Date): string {
  return new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

const sinBom = (t: string) => (t.startsWith("﻿") ? t.slice(1) : t);

interface DatosReel {
  id: string;
  fila: FilaSeguimiento | null;
  video: VideoCalendario | null;
  /** Carpeta relativa a publicar/ que existe en el disco. */
  carpeta: string | null;
  fechaCarpeta: string | null;
  texto: TextoReel | null;
  comentarioFijado: string | null;
}

async function juntarReels(
  publicar: string,
  filas: FilaSeguimiento[],
  videos: VideoCalendario[],
  avisos: string[],
): Promise<DatosReel[]> {
  const mapa = new Map<string, { fila: FilaSeguimiento | null; video: VideoCalendario | null; carpeta: string | null }>();
  for (const fila of filas) mapa.set(fila.id, { fila, video: null, carpeta: fila.carpeta });
  for (const video of videos) {
    const previo = mapa.get(video.id);
    if (previo) {
      previo.video = video;
      previo.carpeta ??= video.carpeta;
    } else {
      mapa.set(video.id, { fila: null, video, carpeta: video.carpeta });
    }
  }
  const nombres = (await readdir(publicar, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const nombre of nombres) {
    const n = leerNombreCarpeta(nombre);
    if (!n || n.fecha === null) continue; // _reserva y las que no son de un día no se leen solas
    const previo = mapa.get(n.id);
    if (!previo) mapa.set(n.id, { fila: null, video: null, carpeta: nombre });
    else if (previo.carpeta === null) previo.carpeta = nombre;
    else if (previo.carpeta !== nombre) {
      avisos.push(`Reel ${n.id}: hay otra carpeta "${nombre}" además de "${previo.carpeta}"; se usó la primera.`);
    }
  }

  const salida: DatosReel[] = [];
  for (const [id, d] of mapa) {
    let carpeta = d.carpeta;
    if (carpeta !== null && !(await existeCarpeta(join(publicar, carpeta)))) {
      avisos.push(`Reel ${id}: la carpeta "${carpeta}" no existe en el disco; se dejó sin carpeta.`);
      carpeta = null;
    }
    let texto: TextoReel | null = null;
    let comentarioFijado: string | null = null;
    if (carpeta !== null) {
      const crudo = await leerSiExiste(join(publicar, carpeta, "texto.txt"));
      if (crudo === null) avisos.push(`Reel ${id}: la carpeta no tiene texto.txt.`);
      else texto = leerTextoTxt(crudo);
      const aparte = await leerSiExiste(join(publicar, carpeta, "comentario-fijado.txt"));
      const limpio = aparte === null ? "" : sinBom(aparte).trim();
      comentarioFijado = limpio === "" ? null : limpio;
    }
    const nombre = carpeta === null ? null : leerNombreCarpeta(basename(carpeta));
    salida.push({ id, fila: d.fila, video: d.video, carpeta, fechaCarpeta: nombre?.fecha ?? null, texto, comentarioFijado });
  }
  return salida;
}

function construirReel(d: DatosReel): ReelNuevo {
  const t = d.texto;
  const nombre = d.carpeta === null ? null : leerNombreCarpeta(basename(d.carpeta));
  return {
    id: d.id,
    slug: nombre?.slug ?? null,
    carpeta: d.carpeta,
    gancho: d.fila?.gancho.trim() || null,
    formato: d.fila?.formato ?? null,
    formatoDetalle: d.fila?.formatoDetalle.trim() || null,
    voz: d.fila?.voz ?? null,
    vozDetalle: d.fila?.vozDetalle ?? null,
    etiquetaIa: d.fila?.etiquetaIa ?? null,
    duracionS: d.fila?.duracionS ?? null,
    puntajeGuion: d.fila?.puntajeGuion ?? null,
    textoTiktok: t ? (t.tiktok ?? t.unArchivo ?? t.general) : null,
    textoMeta: t ? (t.meta ?? t.unArchivo ?? t.general) : null,
    comentarioFijado: t?.comentarioFijado ?? d.comentarioFijado,
    avisos: t?.avisos ?? [],
    fechaPlan: d.video?.fecha ?? d.fechaCarpeta,
    notas: d.fila?.notas.trim() || null,
    estado: "listo",
  };
}

/** Crea el reel o, si existe, llena solo las columnas que están en NULL (o los avisos, si el arreglo está vacío). */
async function guardarReel(db: BaseDeDatos, nuevo: ReelNuevo): Promise<"creado" | "actualizado" | "igual"> {
  const [actual] = await db.select().from(reel).where(eq(reel.id, nuevo.id)).limit(1);
  if (!actual) {
    await db.insert(reel).values(nuevo);
    return "creado";
  }
  const cambios: Partial<ReelNuevo> = {};
  const llenar = <K extends keyof FilaReel & keyof ReelNuevo>(k: K) => {
    if (actual[k] === null && nuevo[k] !== undefined && nuevo[k] !== null) cambios[k] = nuevo[k];
  };
  llenar("slug");
  llenar("carpeta");
  llenar("gancho");
  llenar("formato");
  llenar("formatoDetalle");
  llenar("voz");
  llenar("vozDetalle");
  llenar("etiquetaIa");
  llenar("duracionS");
  llenar("puntajeGuion");
  llenar("textoTiktok");
  llenar("textoMeta");
  llenar("comentarioFijado");
  llenar("fechaPlan");
  llenar("notas");
  if (actual.avisos.length === 0 && nuevo.avisos && nuevo.avisos.length > 0) cambios.avisos = nuevo.avisos;
  if (Object.keys(cambios).length === 0) return "igual";
  await db
    .update(reel)
    .set({ ...cambios, actualizadoEn: new Date() })
    .where(eq(reel.id, nuevo.id));
  return "actualizado";
}

function candidato(d: DatosReel, r: ReelNuevo): ReelCandidato {
  const fechas = [r.fechaPlan, d.fechaCarpeta, d.fila?.fecha].filter((f): f is string => !!f);
  const textos = [r.textoTiktok, r.textoMeta, r.gancho].filter((x): x is string => !!x);
  return {
    id: d.id,
    fechas: [...new Set(fechas)],
    textos: [...new Set(textos)],
    duracionesS: d.fila?.duracionS != null ? [d.fila.duracionS] : [],
  };
}

/** Del texto "a las ~19 h" saca 19; si no aparece, null. */
function horasDelTexto(texto: string): number | null {
  const m = /a las\s*~?\s*(\d+(?:[.,]\d+)?)\s*h\b/i.exec(texto);
  return m?.[1] === undefined ? null : Number(m[1].replace(",", "."));
}

const MS_HORA = 3_600_000;

export async function importar(db: BaseDeDatos, dir: string): Promise<Informe> {
  const publicar = join(dir, "publicar");
  const avisos: string[] = [];
  const informe: Informe = {
    reelsCreados: 0,
    reelsActualizados: 0,
    publicacionesNuevas: 0,
    publicacionesActualizadas: 0,
    lecturasNuevas: 0,
    lecturasRepetidas: 0,
    emparejadosPorRegla: 0,
    sinAsignar: [],
    avisos,
  };

  // ---------- Lectura del disco ----------
  const textoSeguimiento = await leerSiExiste(join(publicar, "seguimiento.csv"));
  const seguimiento = textoSeguimiento === null ? { filas: [], avisos: [] } : leerSeguimiento(textoSeguimiento);
  if (textoSeguimiento === null) avisos.push("No hay seguimiento.csv.");
  avisos.push(...seguimiento.avisos);

  const textoCalendario = await leerSiExiste(join(publicar, "calendario-zernio.json"));
  const calendario = textoCalendario === null ? { videos: [] as VideoCalendario[] } : leerCalendario(JSON.parse(textoCalendario));
  if (textoCalendario === null) avisos.push("No hay calendario-zernio.json.");

  const datos = await juntarReels(publicar, seguimiento.filas, calendario.videos, avisos);

  // ---------- 1. Reels ----------
  const candidatos: ReelCandidato[] = [];
  for (const d of datos) {
    const r = construirReel(d);
    const res = await guardarReel(db, r);
    if (res === "creado") informe.reelsCreados++;
    else if (res === "actualizado") informe.reelsActualizados++;
    candidatos.push(candidato(d, r));
  }

  // ---------- 2. Borradores ----------
  const nuevas = new Set<number>();
  const vistas = new Set<number>();
  const anotar = (r: { id: number; nueva: boolean }) => {
    if (r.nueva) nuevas.add(r.id);
    else vistas.add(r.id);
  };
  const programado = new Map(calendario.videos.map((v) => [v.id, v.programadoPara]));
  const textoBorradores = await leerSiExiste(join(publicar, "zernio-borradores.csv"));
  const porZernioId = new Map<string, string>();
  if (textoBorradores !== null) {
    const idsDeReels = new Set(datos.map((d) => d.id));
    for (const b of leerBorradoresCsv(textoBorradores)) {
      if (!idsDeReels.has(b.reelId)) {
        avisos.push(`Borrador del reel ${b.reelId} (${b.red}): el reel no existe; se saltó.`);
        continue;
      }
      if (b.zernioPostId) porZernioId.set(b.zernioPostId, b.reelId);
      const vista: PublicacionVista = {
        red: b.red,
        origen: "zernio",
        cuenta: null,
        postIdPlataforma: b.postIdPlataforma,
        zernioPostId: b.zernioPostId,
        etiquetas: [`reel-${b.reelId}`],
        enlace: null,
        texto: null,
        duracionS: null,
        programadoPara: programado.get(b.reelId) ?? null,
        publicadoEn: null,
        estado: "borrador",
      };
      anotar(await guardarPublicacion(db, vista, { reelId: b.reelId, por: "id" }));
    }
  }

  // ---------- 3. Métricas ----------
  const dirMetricas = join(publicar, "metricas");
  const todos = (await existeCarpeta(dirMetricas)) ? await readdir(dirMetricas) : [];
  const archivos = todos.filter((n) => /^\d{4}-\d{2}-\d{2}\.csv$/.test(n)).sort();
  for (const nombre of archivos) {
    const ruta = join(dirMetricas, nombre);
    const leidoEn = (await stat(ruta)).mtime;
    const posts = leerMetricasCsv(await readFile(ruta, "utf8"), leidoEn);
    avisos.push(`metricas/${nombre}: la hora de lectura (${leidoEn.toISOString()}) es la de modificación del archivo; es aproximada.`);

    // Lo que ya está en la base: los posts con reel asignado por id, etiqueta o a mano. Los asignados por regla
    // (fecha + texto) se vuelven a decidir, para que la procedencia "por regla" no se pierda al repetir.
    const conocidos = await db
      .select({ red: publicacion.red, id: publicacion.postIdPlataforma, reelId: publicacion.reelId, por: publicacion.emparejadoPor })
      .from(publicacion)
      .where(isNotNull(publicacion.reelId));
    const porPostId = new Map<string, string>();
    for (const c of conocidos) {
      if (c.id !== null && c.reelId !== null && c.por !== "fecha_texto") porPostId.set(`${c.red}:${c.id}`, c.reelId);
    }
    const ctx: ContextoEmparejar = { porZernioId, porPostId, reels: candidatos };

    const resultados = emparejarLote(
      posts.map((p) => p.publicacion),
      ctx,
    );
    for (const [i, post] of posts.entries()) {
      const res = resultados[i];
      if (!res) throw new Error("emparejarLote devolvió menos resultados que publicaciones.");
      const p = post.publicacion;
      const emparejamiento = res.reelId === null ? { reelId: null, por: null } : { reelId: res.reelId, por: res.por };
      const guardada = await guardarPublicacion(db, p, emparejamiento);
      anotar(guardada);
      if (res.reelId !== null && res.por === "fecha_texto") informe.emparejadosPorRegla++;
      if (res.reelId === null) {
        informe.sinAsignar.push({
          red: p.red,
          fecha: p.publicadoEn ? fechaBogota(p.publicadoEn) : null,
          texto: (p.texto ?? "(sin texto)").slice(0, 50),
        });
      }
      if (post.lectura) {
        const nueva = await guardarLectura(db, guardada.id, p.publicadoEn, post.lectura, leidoEn, NOTA_HORA_APROXIMADA);
        if (nueva) informe.lecturasNuevas++;
        else informe.lecturasRepetidas++;
        for (const e of post.lectura.errores) avisos.push(`metricas/${nombre}, ${p.red} ${p.postIdPlataforma ?? ""}: ${e}`);
      }
    }
  }

  // ---------- 4. Cifras manuales de 48 h ----------
  const publicadas = await db
    .select({ id: publicacion.id, reelId: publicacion.reelId, red: publicacion.red, publicadoEn: publicacion.publicadoEn, estado: publicacion.estado })
    .from(publicacion)
    .where(isNotNull(publicacion.reelId));
  for (const fila of seguimiento.filas) {
    const porRed = new Map<Red, LecturaManual[]>();
    for (const m of fila.cifras48h) porRed.set(m.red, [...(porRed.get(m.red) ?? []), m]);
    for (const [red, campos] of porRed) {
      const pubs = publicadas.filter((p) => p.reelId === fila.id && p.red === red && p.estado !== "borrador");
      const unica = pubs.length === 1 ? pubs[0] : undefined;
      if (!unica) {
        const motivo = pubs.length === 0 ? "no hay publicación" : `hay ${pubs.length} publicaciones`;
        avisos.push(`Reel ${fila.id}, ${red}: ${motivo}; no se guardaron las cifras manuales.`);
        continue;
      }
      if (!unica.publicadoEn) {
        avisos.push(`Reel ${fila.id}, ${red}: la publicación no tiene fecha de publicación; no se guardaron las cifras manuales.`);
        continue;
      }
      const horasPorCampo = campos.map((c) => horasDelTexto(c.textoOriginal)).filter((h): h is number => h !== null);
      const horas = horasPorCampo[0] ?? 48;
      if (new Set(horasPorCampo).size > 1) {
        avisos.push(`Reel ${fila.id}, ${red}: las cifras manuales traen horas distintas (${[...new Set(horasPorCampo)].join(", ")}); se usó ${horas} h.`);
      }
      const cifras = cifrasVacias();
      for (const c of campos) cifras[c.campo] = c.valor;
      const lectura: LecturaVista = {
        fuente: "manual",
        via: "captura",
        datoActualizadoEn: new Date(unica.publicadoEn.getTime() + horas * MS_HORA),
        cifras,
        reacciones: null,
        paisPrincipal: null,
        curva: null,
        errores: [],
      };
      const nota = campos.map((c) => `${c.campo}: ${c.textoOriginal}`).join(" | ");
      const nueva = await guardarLectura(db, unica.id, unica.publicadoEn, lectura, new Date(), nota);
      if (nueva) informe.lecturasNuevas++;
      else informe.lecturasRepetidas++;
    }
  }

  informe.publicacionesNuevas = nuevas.size;
  informe.publicacionesActualizadas = [...vistas].filter((id) => !nuevas.has(id)).length;
  return informe;
}
