import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cifra, ChipFuente, type FormatoCifra } from "@/componentes/cifra";
import { EstadoPublicacionBadge } from "@/componentes/estado-publicacion";
import { NOMBRE_FORMATO, NOMBRE_RED, NOMBRE_VOZ } from "@/componentes/etiquetas";
import { FormularioReel } from "@/componentes/formulario-reel";
import { TarjetaComentario } from "@/componentes/tarjeta-comentario";
import { GraficaCrecimiento, GraficaRetencion, type SerieGrafica } from "@/componentes/graficas";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { bd } from "@/servidor/db/cliente";
import { comentariosDeReel } from "@/servidor/consultas/comentarios";
import { consultarDetalle } from "@/servidor/consultas/detalle";
import { formatoFechaHora } from "@/servidor/consultas/formato";
import { ahoraServidor } from "@/servidor/consultas/tiempo";
import type { CifrasResueltas } from "@/servidor/consultas/cifras";

export const dynamic = "force-dynamic";
export const metadata = { title: "Video · BTW Insights" };

const COLOR_RED = { tiktok: "var(--chart-1)", instagram: "var(--chart-2)", facebook: "var(--chart-3)" } as const;

const FILAS: { campo: keyof Pick<CifrasResueltas, "vistas" | "meGusta" | "comentarios" | "compartidos" | "guardados" | "tiempoPromedioS" | "pctCompleto" | "pctPasa3s">; texto: string; formato: FormatoCifra }[] = [
  { campo: "vistas", texto: "Vistas", formato: "entero" },
  { campo: "meGusta", texto: "Me gusta", formato: "entero" },
  { campo: "comentarios", texto: "Comentarios", formato: "entero" },
  { campo: "compartidos", texto: "Compartidos", formato: "entero" },
  { campo: "guardados", texto: "Guardados", formato: "entero" },
  { campo: "tiempoPromedioS", texto: "Tiempo promedio", formato: "segundos" },
  { campo: "pctCompleto", texto: "% completo", formato: "porcentaje" },
  { campo: "pctPasa3s", texto: "% que pasa del 3", formato: "porcentaje" },
];

function Texto({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null;
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">{titulo}</h3>
      <p className="mt-1 text-sm whitespace-pre-wrap">{texto}</p>
    </div>
  );
}

export default async function PaginaDetalle({ params }: { params: Promise<{ id: string }> }) {
  await exigirSesion();
  const { id } = await params;
  let reelId = id;
  try {
    reelId = decodeURIComponent(id);
  } catch {
    // Un id con % mal formado no existe: se queda tal cual y cae en "no encontrado".
  }
  const ahora = ahoraServidor();
  const [d, comentarios] = await Promise.all([consultarDetalle(bd(), reelId), comentariosDeReel(bd(), reelId)]);
  if (!d) notFound();
  const { reel } = d;

  const series: SerieGrafica[] = d.crecimiento.series.map((s) => ({
    clave: s.clave,
    nombre: s.nombre,
    color: COLOR_RED[s.red],
    punteada: s.tipo === "mediana",
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/videos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Videos
        </Link>
        <h1 className="mt-2 text-xl font-semibold">
          {reel.id} · {reel.gancho ?? "sin gancho"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {reel.formato ? NOMBRE_FORMATO[reel.formato] : "Formato sin definir"} · {reel.voz ? NOMBRE_VOZ[reel.voz] : "voz sin definir"}
          {reel.duracionS !== null && ` · ${Math.round(reel.duracionS)} s`}
        </p>
      </div>

      <section aria-labelledby="pubs" className="flex flex-col gap-3">
        <h2 id="pubs" className="text-base font-semibold">
          Publicaciones
        </h2>
        {d.publicaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este reel no tiene publicaciones.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-3">
            {d.publicaciones.map(({ publicacion: p }) => (
              <li key={p.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{NOMBRE_RED[p.red]}</span>
                  <EstadoPublicacionBadge estado={p.estado} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.publicadoEn ? `Salió ${formatoFechaHora(p.publicadoEn)}` : p.programadoPara ? `Programado ${formatoFechaHora(p.programadoPara)}` : "Sin fecha"}
                </p>
                {p.enlace && (
                  <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline">
                    Abrir publicación <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.publicaciones.some(({ publicacion: p }) => p.estado === "publicado" || p.estado === "parcial") && (
        <section aria-labelledby="cifras" className="flex flex-col gap-3">
          <h2 id="cifras" className="text-base font-semibold">
            Cifras por red
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {d.publicaciones
              .filter(({ publicacion: p }) => p.estado === "publicado" || p.estado === "parcial")
              .map(({ publicacion: p, ultima, h48, d7 }) => (
                <Card key={p.id} className="min-w-0 gap-3 py-4">
                  <CardHeader className="gap-0">
                    <CardTitle className="text-sm">{NOMBRE_RED[p.red]}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead />
                            <TableHead className="text-right">Última</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {FILAS.map((f) => (
                            <TableRow key={f.campo}>
                              <TableCell className="text-xs text-muted-foreground">{f.texto}</TableCell>
                              <TableCell className="text-right">
                                <Cifra cifra={ultima[f.campo]} formato={f.formato} alinear="derecha" aproxHoras={ultima.aproxHoras[f.campo]} ahora={ahora} />
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell className="text-xs text-muted-foreground">Vistas a 48 h</TableCell>
                            <TableCell className="text-right">
                              <Cifra cifra={h48.vistas} formato="entero" alinear="derecha" aproxHoras={h48.aproxHoras.vistas} ahora={ahora} />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-xs text-muted-foreground">Vistas a 7 días</TableCell>
                            <TableCell className="text-right">
                              <Cifra cifra={d7.vistas} formato="entero" alinear="derecha" aproxHoras={d7.aproxHoras.vistas} ahora={ahora} />
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      )}

      <section aria-labelledby="crecimiento" className="flex flex-col gap-3">
        <h2 id="crecimiento" className="text-base font-semibold">
          Curva de crecimiento
        </h2>
        {d.crecimiento.filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay lecturas con horas desde la publicación.</p>
        ) : (
          <Card className="min-w-0 py-4">
            <CardContent>
              <GraficaCrecimiento filas={d.crecimiento.filas} series={series} />
              <p className="mt-2 text-xs text-muted-foreground">
                Solo los puntos leídos, sin interpolar. La mediana usa los últimos 10 de la misma red con lecturas a ±12 h de cada marca (mínimo 3 videos).
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {d.retencion && (
        <section aria-labelledby="retencion" className="flex flex-col gap-3">
          <h2 id="retencion" className="flex flex-wrap items-center gap-2 text-base font-semibold">
            Retención en TikTok
            <ChipFuente fuente={d.retencion.fuente} datoActualizadoEn={d.retencion.datoActualizadoEn} ahora={ahora} />
          </h2>
          <Card className="min-w-0 py-4">
            <CardContent>
              <GraficaRetencion
                filas={d.retencion.puntos}
                nombreMejor={d.retencion.mejor ? `${d.retencion.mejor.reelId}` : null}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {d.retencion.mejor
                  ? `Comparada con la curva de mayor retención promedio del mismo formato (${d.retencion.mejor.reelId}${d.retencion.mejor.gancho ? ` · ${d.retencion.mejor.gancho}` : ""}).`
                  : "No hay otra curva del mismo formato para comparar."}
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {d.trafico && (
        <section aria-labelledby="trafico" className="flex flex-col gap-3">
          <h2 id="trafico" className="text-base font-semibold">
            De dónde viene (TikTok)
          </h2>
          <Card className="min-w-0 py-4">
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Para ti</p>
                <Cifra cifra={d.trafico.paraTi} formato="porcentaje" ahora={ahora} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Búsqueda</p>
                <Cifra cifra={d.trafico.busqueda} formato="porcentaje" ahora={ahora} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">No seguidores</p>
                <Cifra cifra={d.trafico.noSeguidores} formato="porcentaje" ahora={ahora} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">País principal{d.trafico.pais ? `: ${d.trafico.pais}` : ""}</p>
                <Cifra cifra={d.trafico.paisPct} formato="porcentaje" ahora={ahora} />
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-labelledby="comentarios" className="flex flex-col gap-3">
        <h2 id="comentarios" className="text-base font-semibold">
          Comentarios
        </h2>
        {comentarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este reel no tiene comentarios de otras personas guardados.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {comentarios.map((c) => (
              <TarjetaComentario key={c.id} comentario={c} mostrarReel={false} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="textos" className="flex flex-col gap-3">
        <h2 id="textos" className="text-base font-semibold">
          Guion y textos
        </h2>
        <Card className="min-w-0 py-4">
          <CardContent className="flex flex-col gap-4">
            <Texto titulo="Gancho" texto={reel.gancho} />
            <Texto titulo="Guion" texto={reel.guion} />
            <Texto titulo="Texto de TikTok" texto={reel.textoTiktok} />
            <Texto titulo="Texto de Instagram y Facebook" texto={reel.textoMeta} />
            <Texto titulo="Comentario fijado" texto={reel.comentarioFijado} />
            {reel.avisos.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Antes de publicar</h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-aviso">
                  {reel.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {!reel.guion && !reel.textoTiktok && !reel.textoMeta && !reel.gancho && (
              <p className="text-sm text-muted-foreground">Este reel no tiene guion ni textos guardados.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="notas" className="flex flex-col gap-3">
        <h2 id="notas" className="text-base font-semibold">
          Notas, formato y voz
        </h2>
        <Card className="min-w-0 py-4">
          <CardContent>
            <FormularioReel reelId={reel.id} notas={reel.notas} formato={reel.formato} voz={reel.voz} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
