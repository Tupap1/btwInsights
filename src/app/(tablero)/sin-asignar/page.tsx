import { ExternalLink } from "lucide-react";
import { FormularioAsignar } from "@/componentes/formulario-asignar";
import { NOMBRE_RED } from "@/componentes/etiquetas";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { bd } from "@/servidor/db/cliente";
import { formatoFechaHora } from "@/servidor/consultas/formato";
import { consultarSinAsignar } from "@/servidor/consultas/sin-asignar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sin asignar · BTW Insights" };

export default async function PaginaSinAsignar() {
  await exigirSesion();
  const { publicaciones, reels } = await consultarSinAsignar(bd());
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">Sin asignar</h1>
        <p className="text-sm text-muted-foreground">
          Publicaciones que ya salieron y no se pudieron unir a un reel. Asignar solo cambia el tablero; no toca la red social.
        </p>
      </header>
      {publicaciones.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">No hay publicaciones sin asignar.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {publicaciones.map((p) => (
            <li key={p.id}>
              <Card className="h-full gap-3 py-4">
                <CardHeader className="gap-1">
                  <CardTitle className="flex items-center justify-between gap-2 text-sm">
                    {NOMBRE_RED[p.red]}
                    <span className="text-xs font-normal text-muted-foreground">{p.publicadoEn ? formatoFechaHora(p.publicadoEn) : "sin fecha"}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="line-clamp-4 text-sm whitespace-pre-wrap">{p.texto ?? "Sin texto"}</p>
                  {p.enlace && (
                    <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs underline-offset-4 hover:underline">
                      Abrir publicación <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                  <FormularioAsignar publicacionId={p.id} reels={reels} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
