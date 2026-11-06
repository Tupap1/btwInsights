// Un comentario como tarjeta (celular primero). Solo muestra el @ y el texto de quien comenta; no responde
// (responder sería escribir en Zernio). El texto se pinta como texto, nunca como HTML.
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { NOMBRE_RED } from "@/componentes/etiquetas";
import { Badge } from "@/componentes/ui/badge";
import { cn } from "@/lib/utils";
import type { TarjetaComentario as Datos } from "@/servidor/consultas/comentarios";
import { formatoFechaHora } from "@/servidor/consultas/formato";

export function TarjetaComentario({ comentario: c, mostrarReel = true }: { comentario: Datos; mostrarReel?: boolean }) {
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium break-all">{c.autorUsuario ? `@${c.autorUsuario}` : "sin usuario"}</span>
        <span className="text-xs text-muted-foreground">{NOMBRE_RED[c.red]}</span>
        <span className="text-xs text-muted-foreground">{c.creadoEn ? formatoFechaHora(c.creadoEn) : "sin fecha"}</span>
        {c.respondido !== null && (
          <Badge variant="outline" className={cn("ml-auto font-normal", c.respondido ? "border-bueno/40 text-bueno" : "border-aviso/50 text-aviso")}>
            {c.respondido ? "Respondido" : "Sin responder"}
          </Badge>
        )}
      </div>
      <p className="break-words whitespace-pre-wrap">{c.texto === "" ? "(sin texto)" : c.texto}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {mostrarReel && c.reelId && (
          <Link href={`/videos/${encodeURIComponent(c.reelId)}`} className="underline-offset-4 hover:underline">
            Reel {c.reelId}
          </Link>
        )}
        {c.enlace && (
          <a href={c.enlace} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
            Abrir en {NOMBRE_RED[c.red]} <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </li>
  );
}
