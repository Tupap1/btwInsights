// Lector de `seguimiento.csv` (la hoja de Andrés, una fila por reel). Función pura: recibe el contenido ya leído.
//
// Ignora a propósito las columnas comentarios_lavado, envios y mensajes (no son cifras del tablero) y las horas
// (hora_fb_ig y hora_tiktok traen texto libre; el emparejamiento usa las fechas y los textos).
// Regla de oro: si no se puede saber con certeza de qué red es un número, se salta y se anota en `avisos`.
import { parse } from "csv-parse/sync";
import { z } from "zod";
import type { Cifras, Formato, Red, Voz } from "../tipos";

/** Una cifra que Andrés anotó a mano en la hoja (vigente a las ~48 h). */
export interface LecturaManual {
  red: Red;
  campo: keyof Cifras;
  valor: number;
  /** El texto de la celda completo, para poder revisarlo. */
  textoOriginal: string;
}

export interface FilaSeguimiento {
  id: string;
  /** Fecha (AAAA-MM-DD) en que salió, según Andrés. */
  fecha: string;
  dia: string;
  /** Carpeta del reel dentro de `publicar/`; null si la celda no es una carpeta. Puede ser `_reserva/…`. */
  carpeta: string | null;
  prueba: string;
  cuerpo: string;
  gancho: string;
  voz: Voz | null;
  /** El texto de la celda `voz` tal cual; null si estaba vacía. */
  vozDetalle: string | null;
  formato: Formato;
  /** Prueba y cuerpo juntos, de donde sale el formato. */
  formatoDetalle: string;
  /** "Sí…" → true, "No…" → false, "por confirmar" o vacío → null. */
  etiquetaIa: boolean | null;
  estadoTexto: string;
  notas: string;
  duracionS: number | null;
  /** Puntaje del guion sobre 12 (de "Guion 11 de 12" o "12 de 12"). */
  puntajeGuion: number | null;
  enlaces: Record<Red, string | null>;
  cifras48h: LecturaManual[];
}

export interface ResultadoSeguimiento {
  filas: FilaSeguimiento[];
  avisos: string[];
}

const celda = z.string().default("");
const esquemaFila = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dia: celda,
  id: z.string().min(1),
  carpeta: celda,
  prueba: celda,
  cuerpo: celda,
  gancho: celda,
  voz: celda,
  etiqueta_ia: celda,
  estado: celda,
  link_tiktok: celda,
  link_instagram: celda,
  link_facebook: celda,
  vistas_48h_tiktok: celda,
  vistas_48h_instagram: celda,
  vistas_48h_facebook: celda,
  tiempo_promedio_s: celda,
  pct_pasa_3s: celda,
  pct_completo: celda,
  notas: celda,
});
type FilaCruda = z.infer<typeof esquemaFila>;

/**
 * Formato, mirando prueba y cuerpo (en este orden de prioridad, sin importar mayúsculas):
 * "La cuenta" → la_cuenta; "Diálogo" → dialogo; "Prueba real" → prueba_real; "3D" → plata_3d;
 * "Pantalla dividida" → pantalla_dividida; si no, otro.
 */
export function clasificarFormato(prueba: string, cuerpo: string): Formato {
  const t = `${prueba} ${cuerpo}`;
  if (/\bla cuenta\b/i.test(t)) return "la_cuenta";
  if (/\bdi[aá]logo\b/i.test(t)) return "dialogo";
  if (/\bprueba real\b/i.test(t)) return "prueba_real";
  if (/\b3D\b/i.test(t)) return "plata_3d";
  if (/\bpantalla dividida\b/i.test(t)) return "pantalla_dividida";
  return "otro";
}

/**
 * Voz: contiene "Fernando" → fernando; "Sin voz" → sin_voz; "Voice Changer" → andres_voice_changer;
 * empieza con "Andrés" → andres; vacío → null; lo demás (Sebastián, Diana, ElevenLabs…) → otra.
 */
export function clasificarVoz(texto: string): Voz | null {
  const t = texto.trim();
  if (t === "") return null;
  if (/fernando/i.test(t)) return "fernando";
  if (/sin voz/i.test(t)) return "sin_voz";
  if (/voice changer/i.test(t)) return "andres_voice_changer";
  if (/^andr[eé]s/i.test(t)) return "andres";
  return "otra";
}

/** "Sí…" → true, "No…" → false, cualquier otra cosa ("por confirmar", vacío) → null. */
export function interpretarEtiquetaIa(texto: string): boolean | null {
  const t = texto.trim();
  // `\b` no sirve después de "í" (no es letra ASCII para JS).
  if (/^s[ií](?![a-záéíóúñ])/i.test(t)) return true;
  if (/^no\b/i.test(t)) return false;
  return null;
}

/** Número con coma decimal ("42,9" → 42.9). */
function numeroEs(texto: string): number {
  return Number(texto.replace(",", "."));
}

/** Duración de textos como "propio (42,9 s)" o "propio (95 s)". */
export function extraerDuracionS(cuerpo: string): number | null {
  const m = /\((\d+(?:,\d+)?)\s*s\)/.exec(cuerpo);
  return m?.[1] === undefined ? null : numeroEs(m[1]);
}

/** Puntaje de "Guion 11 de 12" o "12 de 12", buscando primero en las notas y luego en la prueba. */
export function extraerPuntajeGuion(notas: string, prueba: string): number | null {
  for (const texto of [notas, prueba]) {
    const m = /(?<![\d,.])(\d{1,2}) de 12\b/.exec(texto);
    if (m?.[1] !== undefined) {
      const n = Number(m[1]);
      if (n <= 12) return n;
    }
  }
  return null;
}

const REDES_POR_ETIQUETA: Record<string, Red | undefined> = {
  fb: "facebook",
  ig: "instagram",
  tiktok: "tiktok",
};

/** Vistas: el entero inicial ("204 a las ~19 h (subió…)" → 204). Un decimal o miles no se acepta. */
function leerVistas(texto: string): number | null {
  const m = /^\s*(\d+)(?![.,]\d)/.exec(texto);
  return m?.[1] === undefined ? null : Number(m[1]);
}

/**
 * Cifras que pueden venir con varias redes: "7 (FB) / 2,96 (TikTok)", "15% (FB, 32 de 211)".
 * Cada segmento (separado por "/" o ";") debe ser exactamente: número, % opcional y paréntesis cuyo primer
 * elemento sea la red. Cualquier otra forma ("6,5% llega a 20 s (FB)") se salta con un aviso.
 */
function leerPorRed(
  texto: string,
  campo: keyof Cifras,
  columna: string,
  idReel: string,
  avisos: string[],
): LecturaManual[] {
  const salida: LecturaManual[] = [];
  for (const segmento of texto.split(/\s*[/;]\s*/)) {
    const s = segmento.trim();
    if (s === "") continue;
    const m = /^(\d+(?:,\d+)?)\s*%?\s*\(([^)]*)\)$/.exec(s);
    const etiqueta = m?.[2]?.split(",")[0]?.trim().toLowerCase();
    const red = etiqueta === undefined ? undefined : REDES_POR_ETIQUETA[etiqueta];
    if (m?.[1] === undefined || red === undefined) {
      avisos.push(`Reel ${idReel}, ${columna}: no se sabe con certeza la red de "${s}"; se saltó.`);
      continue;
    }
    salida.push({ red, campo, valor: numeroEs(m[1]), textoOriginal: texto });
  }
  return salida;
}

function leerCifras48h(f: FilaCruda, avisos: string[]): LecturaManual[] {
  const salida: LecturaManual[] = [];
  const vistas: [string, Red, string][] = [
    [f.vistas_48h_tiktok, "tiktok", "vistas_48h_tiktok"],
    [f.vistas_48h_instagram, "instagram", "vistas_48h_instagram"],
    [f.vistas_48h_facebook, "facebook", "vistas_48h_facebook"],
  ];
  for (const [texto, red, columna] of vistas) {
    if (texto.trim() === "") continue;
    const valor = leerVistas(texto);
    if (valor === null) {
      avisos.push(`Reel ${f.id}, ${columna}: no se encontró un entero inicial en "${texto}"; se saltó.`);
      continue;
    }
    salida.push({ red, campo: "vistas", valor, textoOriginal: texto });
  }
  const porRed: [string, keyof Cifras, string][] = [
    [f.tiempo_promedio_s, "tiempoPromedioS", "tiempo_promedio_s"],
    [f.pct_pasa_3s, "ret3s", "pct_pasa_3s"],
    [f.pct_completo, "pctCompleto", "pct_completo"],
  ];
  for (const [texto, campo, columna] of porRed) {
    if (texto.trim() !== "") salida.push(...leerPorRed(texto, campo, columna, f.id, avisos));
  }
  return salida;
}

/** Una carpeta válida es `AAAA-MM-DD_…` o `_reserva/…`; "(antes de publicar/)" y similares no lo son. */
function leerCarpeta(texto: string): string | null {
  const t = texto.trim();
  return /^(?:_reserva\/|\d{4}-\d{2}-\d{2}_)\S+$/.test(t) ? t : null;
}

function leerEnlace(texto: string, columna: string, idReel: string, avisos: string[]): string | null {
  const t = texto.trim();
  if (t === "") return null;
  if (/^https?:\/\//i.test(t)) return t;
  avisos.push(`Reel ${idReel}, ${columna}: "${t}" no es un enlace; se dejó vacío.`);
  return null;
}

export function leerSeguimiento(contenido: string): ResultadoSeguimiento {
  // Se lee como arreglos para detectar filas con columnas de más o de menos (una coma sin comillas en una celda).
  // Esas filas no se adivinan: se saltan con un aviso para que Andrés las corrija en la hoja.
  const [encabezado = [], ...registros]: string[][] = parse(contenido, { bom: true, skip_empty_lines: true, relax_column_count: true });
  const avisos: string[] = [];
  const crudas: { linea: number; fila: Record<string, string> }[] = [];
  registros.forEach((reg, i) => {
    const linea = i + 2;
    if (reg.length !== encabezado.length) {
      avisos.push(`seguimiento.csv, línea ${linea} (reel ${reg[2] ?? "?"}): tiene ${reg.length} columnas y deben ser ${encabezado.length}. Probablemente una celda con coma sin comillas. Se saltó la fila.`);
      return;
    }
    crudas.push({ linea, fila: Object.fromEntries(encabezado.map((k, j) => [k, reg[j] ?? ""])) });
  });
  const filas = crudas.flatMap(({ linea, fila }): FilaSeguimiento[] => {
    const r = esquemaFila.safeParse(fila);
    if (!r.success) {
      avisos.push(`seguimiento.csv, línea ${linea}: forma inesperada; se saltó la fila.`);
      return [];
    }
    const f = r.data;
    const voz = f.voz.trim();
    return [{
      id: f.id.trim(),
      fecha: f.fecha,
      dia: f.dia.trim(),
      carpeta: leerCarpeta(f.carpeta),
      prueba: f.prueba,
      cuerpo: f.cuerpo,
      gancho: f.gancho,
      voz: clasificarVoz(f.voz),
      vozDetalle: voz === "" ? null : f.voz,
      formato: clasificarFormato(f.prueba, f.cuerpo),
      formatoDetalle: [f.prueba, f.cuerpo].filter((x) => x.trim() !== "").join(" · "),
      etiquetaIa: interpretarEtiquetaIa(f.etiqueta_ia),
      estadoTexto: f.estado,
      notas: f.notas,
      duracionS: extraerDuracionS(f.cuerpo),
      puntajeGuion: extraerPuntajeGuion(f.notas, f.prueba),
      enlaces: {
        tiktok: leerEnlace(f.link_tiktok, "link_tiktok", f.id, avisos),
        instagram: leerEnlace(f.link_instagram, "link_instagram", f.id, avisos),
        facebook: leerEnlace(f.link_facebook, "link_facebook", f.id, avisos),
      },
      cifras48h: leerCifras48h(f, avisos),
    }];
  });
  return { filas, avisos };
}
