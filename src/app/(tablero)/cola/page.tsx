import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { EditarBorrador } from "@/componentes/editar-borrador";
import { EstadoPublicacionBadge } from "@/componentes/estado-publicacion";
import { NOMBRE_RED } from "@/componentes/etiquetas";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { cn } from "@/lib/utils";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { bd } from "@/servidor/db/cliente";
import { consultarCola } from "@/servidor/consultas/cola";
import { REDES } from "@/servidor/consultas/datos";
import { formatoFechaCola, formatoHora } from "@/servidor/consultas/formato";
import { ahoraServidor, diaBogota, inicioDiaBogota } from "@/servidor/consultas/tiempo";

/** "HH:MM" de Bogotá (UTC-5) para precargar el campo de hora. */
const horaBogota = (f: Date): string => new Date(f.getTime() - 5 * 3_600_000).toISOString().slice(11, 16);

export const dynamic = "force-dynamic";
export const metadata = { title: "Cola · BTW Insights" };

export default async function PaginaCola() {
  await exigirSesion();
  const ahora = ahoraServidor();
  const cola = await consultarCola(bd(), ahora);
  const hoy = diaBogota(ahora);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">Cola de 14 días</h1>
        <p className="text-sm text-muted-foreground">Lo que está programado, en borrador o publicado, por día y por red. Los borradores de TikTok e Instagram se pueden editar (texto y fecha); nada se publica desde aquí.</p>
        {/* Pendiente: el aviso "IA sin etiqueta" necesita la marca de IA de la plataforma, que todavía no se guarda. */}
        <p className="mt-1 text-xs text-muted-foreground">Aviso &quot;IA sin etiqueta&quot;: pendiente (todavía no se guarda la marca de IA de la plataforma).</p>
      </header>

      {cola.avisosFuera.length > 0 && (
        <ul className="flex flex-col gap-1">
          {cola.avisosFuera.map((a) => (
            <li key={`${a.dia}-${a.mensaje}`} className="flex items-center gap-2 rounded-lg border border-malo/50 bg-malo/10 px-3 py-2 text-sm text-malo">
              <TriangleAlert className="size-4 shrink-0" aria-hidden /> {a.mensaje} ({a.dia})
            </li>
          ))}
        </ul>
      )}

      <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cola.dias.map((d) => (
          <li key={d.dia}>
            <Card className={cn("h-full gap-3 py-4", d.dia === hoy && "border-foreground/40")}>
              <CardHeader className="gap-0">
                <CardTitle className="text-sm">
                  {formatoFechaCola(inicioDiaBogota(d.dia))}
                  {d.dia === hoy && <span className="ml-2 text-xs font-normal text-muted-foreground">hoy</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {d.avisos.some((a) => a.tipo !== "sin_video") && (
                  <ul className="flex flex-col gap-1">
                    {d.avisos.filter((a) => a.tipo !== "sin_video").map((a) => (
                      <li
                        key={a.mensaje}
                        className={cn(
                          "flex items-center gap-1.5 text-xs",
                          a.tipo === "fallida" ? "text-malo" : "text-aviso",
                        )}
                      >
                        <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> {a.mensaje}
                      </li>
                    ))}
                  </ul>
                )}
                {REDES.map((red) => (
                  <div key={red} className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-muted-foreground">{NOMBRE_RED[red]}</p>
                    {d.redes[red].length === 0 ? (
                      d.sinVideo.includes(red) ? (
                        <p className="flex items-center gap-1.5 text-xs text-aviso">
                          <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> Día sin video
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">—</p>
                      )
                    ) : (
                      d.redes[red].map((i) => (
                        <div key={i.publicacionId} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate">
                              {i.reelId ? (
                                <Link href={`/videos/${encodeURIComponent(i.reelId)}`} className="underline-offset-4 hover:underline">
                                  {i.reelId}
                                </Link>
                              ) : (
                                "Sin reel"
                              )}
                              <span className="ml-1.5 text-xs text-muted-foreground">{formatoHora(i.momento)}</span>
                            </span>
                            <EstadoPublicacionBadge estado={i.estado} />
                          </div>
                          {i.editable && (
                            <EditarBorrador
                              publicacionId={i.publicacionId}
                              texto={i.texto ?? ""}
                              dia={diaBogota(i.momento)}
                              hora={horaBogota(i.momento)}
                            />
                          )}
                          {i.soloMeta && <p className="text-xs text-muted-foreground">Solo en Meta Business Suite</p>}
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
