// Pasa a la base las ideas (guiones/ideas-*.md) y los guiones (guiones/<id>-*.md). Se puede repetir:
// - Idea nueva (por `fuente`): se inserta. Idea que ya está: se refresca desde el archivo SOLO si sigue en estado
//   "nueva" y sin reel; si ya pasó a reel o cambió de estado, no se toca.
// - Guion: se escribe en reel.guion SOLO si está vacío (lo que Andrés editó no se pisa).
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { BaseDeDatos } from "../db/cliente";
import { idea, reel } from "../db/esquema";
import { leerGuiones, type ArchivoGuion } from "./guiones";
import { leerIdeas, type IdeaLeida } from "./ideas";

export interface InformeIdeas {
  ideasNuevas: number;
  ideasYaEstaban: number;
  guionesPuestos: number;
  guionesYaTenian: number;
  avisos: string[];
}

export async function importarIdeasYGuiones(db: BaseDeDatos, dirGuiones: string): Promise<InformeIdeas> {
  const informe: InformeIdeas = { ideasNuevas: 0, ideasYaEstaban: 0, guionesPuestos: 0, guionesYaTenian: 0, avisos: [] };
  let nombres: string[];
  try {
    nombres = (await readdir(dirGuiones)).filter((n) => n.toLowerCase().endsWith(".md")).sort();
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") {
      informe.avisos.push("No hay carpeta guiones/; no se importaron ideas ni guiones.");
      return informe;
    }
    throw e;
  }
  const archivos: ArchivoGuion[] = [];
  for (const nombre of nombres) archivos.push({ nombre, texto: await readFile(join(dirGuiones, nombre), "utf8") });

  // ---------- Ideas ----------
  const ideas: IdeaLeida[] = [];
  for (const a of archivos.filter((x) => /^ideas-/i.test(x.nombre))) {
    const r = leerIdeas(a.texto, a.nombre);
    ideas.push(...r.ideas);
    informe.avisos.push(...r.avisos);
    if (r.ideas.length === 0) informe.avisos.push(`${a.nombre}: no se encontró ninguna idea.`);
  }
  if (ideas.length > 0) {
    const previas = await db.select({ fuente: idea.fuente }).from(idea).where(inArray(idea.fuente, ideas.map((i) => i.fuente)));
    const yaEstan = new Set(previas.map((p) => p.fuente));
    for (const i of ideas) {
      await db
        .insert(idea)
        .values(i)
        .onConflictDoUpdate({
          target: idea.fuente,
          set: { titulo: i.titulo, gancho: i.gancho, formato: i.formato, funcionBtwash: i.funcionBtwash, puntaje: i.puntaje },
          setWhere: and(eq(idea.estado, "nueva"), isNull(idea.reelId)),
        });
      if (yaEstan.has(i.fuente)) informe.ideasYaEstaban++;
      else informe.ideasNuevas++;
    }
  }

  // ---------- Guiones ----------
  const ids = new Set((await db.select({ id: reel.id }).from(reel)).map((r) => r.id));
  const g = leerGuiones(archivos, ids);
  informe.avisos.push(...g.avisos);
  for (const guion of g.guiones) {
    const puestos = await db
      .update(reel)
      .set({ guion: guion.texto, actualizadoEn: new Date() })
      .where(and(eq(reel.id, guion.reelId), or(isNull(reel.guion), sql`btrim(${reel.guion}) = ''`)))
      .returning({ id: reel.id });
    if (puestos.length > 0) informe.guionesPuestos++;
    else informe.guionesYaTenian++;
  }
  return informe;
}
