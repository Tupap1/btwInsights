// Lee los archivos guiones/ideas-*.md y los vuelve ideas para la tabla `idea`. Función pura: texto -> ideas.
//
// Reglas:
// - Tabla markdown: se busca un encabezado con una columna "Idea"; las demás columnas se encuentran por nombre
//   (sin importar el orden ni las tildes): "#", "Gancho…", "Formato", "Función de BTWash", "Puntaje".
//   Una fila = una idea. Una tabla sin columna "Idea" (p. ej. la de costos) se ignora.
// - Puntaje: se toma "N/12" de la celda (con o sin negritas). Todo lo demás de la celda ("(parecido al 14…)")
//   se ignora: la tabla `idea` no tiene dónde guardarlo. Si la celda no trae N/12 o N pasa de 12, queda null y avisa.
// - Formato: ver `formatoDeTexto`. Si no es uno de los cinco conocidos queda "otro" y el texto original va al final
//   del título, "Título (formato: Mito)", porque `idea` no tiene columna para él.
// - Sin tabla: una idea por encabezado "## Idea X: título" (sin gancho ni puntaje).
// - fuente = "<archivo>#<valor de la columna # o letra de la idea>"; sin columna # se usa el número de fila (1, 2…).
// - Estado inicial: "nueva".
import type { Formato } from "../tipos";

export interface IdeaLeida {
  fuente: string;
  titulo: string;
  gancho: string | null;
  formato: Formato | null;
  funcionBtwash: string | null;
  puntaje: number | null;
  estado: "nueva";
}

export interface IdeasLeidas {
  ideas: IdeaLeida[];
  avisos: string[];
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normal = (t: string) => sinTildes(t).toLowerCase().replace(/[*_`]/g, "").trim();
const limpiar = (t: string) => t.replace(/\*\*/g, "").trim();

/**
 * Equivalencias del formato (se compara el comienzo del texto, sin tildes ni mayúsculas):
 * "Plata en 3D" / "Plata 3D" -> plata_3d; "Diálogo…" -> dialogo; "Prueba real…" -> prueba_real;
 * "Pantalla dividida…" -> pantalla_dividida; "La cuenta…" -> la_cuenta; vacío -> null; lo demás -> otro.
 */
export function formatoDeTexto(texto: string): Formato | null {
  const t = normal(texto);
  if (t === "" || t === "-") return null;
  if (t.startsWith("plata en 3d") || t.startsWith("plata 3d")) return "plata_3d";
  if (t.startsWith("dialogo")) return "dialogo";
  if (t.startsWith("prueba real")) return "prueba_real";
  if (t.startsWith("pantalla dividida")) return "pantalla_dividida";
  if (t.startsWith("la cuenta")) return "la_cuenta";
  return "otro";
}

function celdas(linea: string): string[] {
  const t = linea.trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

const esSeparador = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

function columna(encabezados: string[], ...nombres: string[]): number {
  return encabezados.findIndex((h) => nombres.some((n) => (n === "#" ? h === "#" : h.startsWith(n))));
}

function puntajeDe(celda: string, avisos: string[], donde: string): number | null {
  if (celda.trim() === "") return null;
  const m = /(\d{1,2})\s*\/\s*12\b/.exec(limpiar(celda));
  const n = m ? Number(m[1]) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 12) {
    avisos.push(`${donde}: el puntaje "${limpiar(celda)}" no es N/12 (de 0 a 12); queda sin puntaje.`);
    return null;
  }
  return n;
}

function leerTablas(texto: string, archivo: string, avisos: string[]): IdeaLeida[] | null {
  const lineas = texto.split(/\r?\n/);
  const ideas: IdeaLeida[] = [];
  let hayTabla = false;
  for (let i = 0; i < lineas.length - 1; i++) {
    const enc = lineas[i] ?? "";
    if (!enc.trim().startsWith("|") || !esSeparador(lineas[i + 1] ?? "")) continue;
    const nombres = celdas(enc).map(normal);
    const cIdea = columna(nombres, "idea");
    if (cIdea < 0) continue;
    hayTabla = true;
    const cNum = columna(nombres, "#");
    const cGancho = columna(nombres, "gancho");
    const cFormato = columna(nombres, "formato");
    const cFuncion = columna(nombres, "funcion");
    const cPuntaje = columna(nombres, "puntaje");
    let fila = 0;
    for (let j = i + 2; j < lineas.length && (lineas[j] ?? "").trim().startsWith("|"); j++) {
      fila++;
      const c = celdas(lineas[j] ?? "");
      const titulo = limpiar(c[cIdea] ?? "");
      if (titulo === "") continue;
      const clave = (cNum >= 0 ? limpiar(c[cNum] ?? "") : "") || String(fila);
      const donde = `${archivo}, fila ${clave}`;
      const textoFormato = cFormato >= 0 ? limpiar(c[cFormato] ?? "") : "";
      const formato = formatoDeTexto(textoFormato);
      const gancho = cGancho >= 0 ? limpiar(c[cGancho] ?? "") : "";
      const funcion = cFuncion >= 0 ? limpiar(c[cFuncion] ?? "") : "";
      ideas.push({
        fuente: `${archivo}#${clave}`,
        titulo: formato === "otro" ? `${titulo} (formato: ${textoFormato})` : titulo,
        gancho: gancho || null,
        formato,
        funcionBtwash: funcion || null,
        puntaje: cPuntaje >= 0 ? puntajeDe(c[cPuntaje] ?? "", avisos, donde) : null,
        estado: "nueva",
      });
    }
  }
  return hayTabla ? ideas : null;
}

function leerEncabezados(texto: string, archivo: string): IdeaLeida[] {
  const ideas: IdeaLeida[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^##\s+Idea\s+([^\s:]+)\s*:\s*(.+?)\s*$/i.exec(linea);
    if (!m) continue;
    const titulo = (m[2] ?? "").replace(/^["“«]+|["”»]+$/g, "").trim();
    ideas.push({
      fuente: `${archivo}#${m[1]}`,
      titulo,
      gancho: null,
      formato: null,
      funcionBtwash: null,
      puntaje: null,
      estado: "nueva",
    });
  }
  return ideas;
}

export function leerIdeas(texto: string, archivo: string): IdeasLeidas {
  const avisos: string[] = [];
  const sinBom = texto.startsWith("﻿") ? texto.slice(1) : texto;
  const deTabla = leerTablas(sinBom, archivo, avisos);
  return { ideas: deTabla ?? leerEncabezados(sinBom, archivo), avisos };
}
