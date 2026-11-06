// Reparte los .md de guiones/ entre los reels. Función pura: archivos + ids de reels existentes -> guiones.
//
// Reglas:
// - `ideas-*.md` no son guiones: se ignoran sin aviso.
// - `<id>-nombre.md`: el id es lo que va antes del primer guion ("08", "09b", "14"). Si ese reel no existe, se salta con aviso.
// - `elige-uno-terror-NN.md`: el reel es TERROR<NN> ("elige-uno-terror-02" -> TERROR02), si existe.
// - `<id>-<id>-nombre.md` (p. ej. 11-13-borradores.md, 17-20-primer-lote.md): junta varios reels. Se parte por
//   los encabezados "## <id> · título" o "## <id>. título"; cada sección llega hasta el siguiente encabezado "## ".
//   Ningún id puede repetirse: si se repite (ambiguo) o no hay secciones, se salta TODO el archivo con aviso.
//   Una sección cuyo reel no existe se salta sola, con aviso; las demás entran. Los ids salen de los encabezados, no del nombre del archivo
//   (17-20-primer-lote.md también trae el 21).
// - Cualquier otro archivo (entrevista-*, etc.) se salta con aviso.
export interface ArchivoGuion {
  nombre: string;
  texto: string;
}
export interface GuionLeido {
  reelId: string;
  texto: string;
  archivo: string;
}
export interface GuionesLeidos {
  guiones: GuionLeido[];
  avisos: string[];
}

const ID = "\\d+[a-z]?";
const RANGO = new RegExp(`^(${ID})-(${ID})-`, "i");
const UNO = new RegExp(`^(${ID})-`, "i");
const TERROR = /^elige-uno-terror-(\d+)/i;

const limpiar = (t: string) => (t.startsWith("﻿") ? t.slice(1) : t).replace(/\r\n/g, "\n").trim();

function partir(a: ArchivoGuion, ids: ReadonlySet<string>): { guiones: GuionLeido[]; aviso?: string } {
  const lineas = limpiar(a.texto).split("\n");
  const secciones: { id: string; desde: number; hasta: number }[] = [];
  const reEnc = new RegExp(`^##\\s+(${ID})\\s*(?:·|\\.|:|-)\\s*\\S`, "i");
  let abierta: { id: string; desde: number } | null = null;
  lineas.forEach((l, i) => {
    if (!l.startsWith("## ")) return;
    if (abierta) secciones.push({ ...abierta, hasta: i });
    const m = reEnc.exec(l);
    abierta = m?.[1] ? { id: m[1], desde: i } : null;
  });
  if (abierta) secciones.push({ ...(abierta as { id: string; desde: number }), hasta: lineas.length });
  if (secciones.length === 0) return { guiones: [], aviso: `${a.nombre}: junta varios reels pero no tiene secciones "## <id> · …"; se saltó.` };
  const vistos = new Set<string>();
  for (const s of secciones) {
    if (vistos.has(s.id)) return { guiones: [], aviso: `${a.nombre}: el reel ${s.id} aparece en dos secciones; es ambiguo y se saltó el archivo.` };
    vistos.add(s.id);
  }
  const sinReel = secciones.filter((s) => !ids.has(s.id)).map((s) => s.id);
  const guiones = secciones.filter((s) => ids.has(s.id)).map((s) => ({
    reelId: s.id,
    archivo: a.nombre,
    texto: lineas.slice(s.desde, s.hasta).join("\n").replace(/\n+(---\s*\n*)*$/, "").trim(),
  }));
  return sinReel.length ? { guiones, aviso: `${a.nombre}: no existe el reel ${sinReel.join(", ")}; esas secciones se saltaron.` } : { guiones };
}

export function leerGuiones(archivos: ArchivoGuion[], idsReels: ReadonlySet<string>): GuionesLeidos {
  const guiones: GuionLeido[] = [];
  const avisos: string[] = [];
  for (const a of archivos) {
    if (/^ideas-/i.test(a.nombre)) continue;
    if (RANGO.test(a.nombre)) {
      const r = partir(a, idsReels);
      guiones.push(...r.guiones);
      if (r.aviso) avisos.push(r.aviso);
      continue;
    }
    const terror = TERROR.exec(a.nombre);
    const id = terror?.[1] ? `TERROR${terror[1]}` : UNO.exec(a.nombre)?.[1];
    if (!id) {
      avisos.push(`${a.nombre}: no empieza con el id de un reel; se saltó.`);
    } else if (!idsReels.has(id)) {
      avisos.push(`${a.nombre}: el reel ${id} no existe; se saltó.`);
    } else {
      guiones.push({ reelId: id, archivo: a.nombre, texto: limpiar(a.texto) });
    }
  }
  return { guiones, avisos };
}
