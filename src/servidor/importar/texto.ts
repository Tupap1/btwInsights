// Lee un texto.txt de btw-videos/publicar. Función pura: recibe el contenido ya leído y no toca el disco.
// Los archivos viejos no tienen encabezados: todo su contenido va a `general`.

export interface TextoReel {
  /** Texto de TikTok (sección "TIKTOK (archivo ...)"). */
  tiktok: string | null;
  /** Texto de Facebook e Instagram (sección "FACEBOOK E INSTAGRAM (archivo ...)"). */
  meta: string | null;
  /** Texto único para las tres redes (sección "TEXTO", o todo el archivo si no tiene encabezados). */
  general: string | null;
  /** Comentario que se fija debajo del video (sección "COMENTARIO FIJADO"). */
  comentarioFijado: string | null;
  /** Notas para Andrés: una línea por cada "- " de la sección "ANTES DE PUBLICAR", sin el guion. */
  avisos: string[];
  /** Sección "UN SOLO ARCHIVO PARA LAS TRES REDES (archivo ...)": notas del video que va en las tres redes. */
  unArchivo: string | null;
}

type Clave = "tiktok" | "meta" | "general" | "comentarioFijado" | "avisos" | "unArchivo";

const BOM = "﻿";

/** Devuelve la sección que abre una línea de encabezado, o null si la línea no es un encabezado. */
function encabezado(linea: string): Clave | null {
  if (linea.startsWith("TIKTOK (")) return "tiktok";
  if (linea.startsWith("FACEBOOK E INSTAGRAM (")) return "meta";
  if (linea.startsWith("UN SOLO ARCHIVO PARA LAS TRES REDES (")) return "unArchivo";
  const sinFinal = linea.trimEnd();
  if (sinFinal === "TEXTO") return "general";
  if (sinFinal === "COMENTARIO FIJADO") return "comentarioFijado";
  if (sinFinal === "ANTES DE PUBLICAR") return "avisos";
  return null;
}

function aTexto(lineas: string[]): string | null {
  const texto = lineas.join("\n").trim();
  return texto === "" ? null : texto;
}

export function leerTextoTxt(contenido: string): TextoReel {
  const sinBom = contenido.startsWith(BOM) ? contenido.slice(BOM.length) : contenido;
  const lineas = sinBom.split(/\r?\n/);

  const secciones: Record<Clave, string[]> = {
    tiktok: [],
    meta: [],
    general: [],
    comentarioFijado: [],
    avisos: [],
    unArchivo: [],
  };
  const avisos: string[] = [];

  // Lo que va antes del primer encabezado solo cuenta si el archivo no tiene ningún encabezado.
  const hayEncabezados = lineas.some((linea) => encabezado(linea) !== null);
  if (!hayEncabezados) {
    secciones.general.push(...lineas);
  } else {
    let actual: Clave | null = null;
    for (const linea of lineas) {
      const nueva = encabezado(linea);
      if (nueva !== null) {
        actual = nueva;
        continue;
      }
      if (actual === null) continue;
      if (actual === "avisos") {
        if (linea.startsWith("- ")) avisos.push(linea.slice(2).trim());
        continue;
      }
      secciones[actual].push(linea);
    }
  }

  return {
    tiktok: aTexto(secciones.tiktok),
    meta: aTexto(secciones.meta),
    general: aTexto(secciones.general),
    comentarioFijado: aTexto(secciones.comentarioFijado),
    avisos: avisos.filter((aviso) => aviso !== ""),
    unArchivo: aTexto(secciones.unArchivo),
  };
}
