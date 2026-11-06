// Pantalla /ideas: el banco de ideas con filtros (estado y formato), de mayor a menor puntaje (sin puntaje al final).
import "server-only";
import { asc, desc, eq, sql, and, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { BaseDeDatos } from "../db/cliente";
import { idea } from "../db/esquema";
import type { Formato } from "../tipos";

export const FORMATOS_IDEA = ["la_cuenta", "dialogo", "prueba_real", "plata_3d", "pantalla_dividida", "otro"] as const;
export const ESTADOS_IDEA = ["nueva", "en_reel"] as const;

export interface FiltrosIdeas {
  estado?: string;
  formato?: Formato;
}

export interface IdeaVista {
  id: number;
  titulo: string;
  gancho: string | null;
  formato: Formato | null;
  funcionBtwash: string | null;
  /** Sobre 12. null = no tiene puntaje (nunca 0). */
  puntaje: number | null;
  estado: string;
  fuente: string | null;
  reelId: string | null;
}

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Lee los filtros de la URL; lo que no sirve se descarta. */
export function leerFiltrosIdeas(crudo: Record<string, string | string[] | undefined>): FiltrosIdeas {
  const estado = z.string().trim().min(1).max(40).safeParse(primero(crudo.estado));
  const formato = z.enum(FORMATOS_IDEA).safeParse(primero(crudo.formato));
  return { estado: estado.success ? estado.data : undefined, formato: formato.success ? formato.data : undefined };
}

export async function consultarIdeas(
  db: BaseDeDatos,
  filtros: FiltrosIdeas,
): Promise<{ ideas: IdeaVista[]; total: number; estados: string[] }> {
  const donde: SQL[] = [];
  if (filtros.estado) donde.push(eq(idea.estado, filtros.estado));
  if (filtros.formato) donde.push(eq(idea.formato, filtros.formato));
  const ideas = await db
    .select({
      id: idea.id,
      titulo: idea.titulo,
      gancho: idea.gancho,
      formato: idea.formato,
      funcionBtwash: idea.funcionBtwash,
      puntaje: idea.puntaje,
      estado: idea.estado,
      fuente: idea.fuente,
      reelId: idea.reelId,
    })
    .from(idea)
    .where(donde.length ? and(...donde) : undefined)
    .orderBy(sql`${idea.puntaje} desc nulls last`, asc(idea.id));
  const todos = await db.select({ estado: idea.estado }).from(idea).orderBy(desc(idea.estado));
  return { ideas, total: todos.length, estados: [...new Set(todos.map((t) => t.estado))].sort() };
}
