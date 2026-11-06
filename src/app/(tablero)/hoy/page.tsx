import Link from "next/link";
import { BotonActualizar } from "@/componentes/boton-actualizar";
import { Cifra } from "@/componentes/cifra";
import { EstadoPublicacionBadge } from "@/componentes/estado-publicacion";
import { NOMBRE_RED } from "@/componentes/etiquetas";
import { Badge } from "@/componentes/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { cn } from "@/lib/utils";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { bd } from "@/servidor/db/cliente";
import { consultarHoy, lecturaVencida, variacion, type Comparada } from "@/servidor/consultas/hoy";
import { formatoDecimal, formatoFechaHora, formatoHora, haceCuanto } from "@/servidor/consultas/formato";
import { ahoraServidor } from "@/servidor/consultas/tiempo";
import type { FormatoCifra } from "@/componentes/cifra";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hoy · BTW Insights" };

function FilaSemana({
  etiqueta,
  datos,
  formato,
  ahora,
}: {
  etiqueta: string;
  datos: Comparada;
  formato: FormatoCifra;
  ahora: Date;
}) {
  const cambio = variacion(datos.actual.valor, datos.anterior.valor);
  return (
    <div className="flex items-start justify-between gap-3 border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        <Cifra cifra={datos.actual} formato={formato} grande ahora={ahora} />
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        <p className="text-[11px] text-muted-foreground">semana anterior</p>
        <Cifra cifra={datos.anterior} formato={formato} alinear="derecha" ahora={ahora} />
        {cambio !== null && (
          <span className={cn("text-xs font-medium", cambio >= 0 ? "text-bueno" : "text-malo")}>
            {cambio >= 0 ? "+" : "−"}
            {formatoDecimal(Math.abs(cambio))} %
          </span>
        )}
      </div>
    </div>
  );
}

export default async function PaginaHoy() {
  await exigirSesion();
  const ahora = ahoraServidor();
  const hoy = await consultarHoy(bd(), ahora);
  const vencida = lecturaVencida(hoy.ultimaLectura, ahora);

  return (
    <div className="flex flex-col gap-6">
      {vencida && (
        <div role="alert" className="rounded-lg border border-malo/50 bg-malo/10 px-4 py-3 text-sm text-malo">
          {hoy.ultimaLectura
            ? `La última lectura fue ${haceCuanto(hoy.ultimaLectura, ahora)}. Las cifras pueden estar viejas.`
            : "Todavía no hay ninguna lectura buena. Las cifras no están al día."}
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Hoy</h1>
          <p className="text-sm text-muted-foreground">
            {hoy.ultimaLectura
              ? `Última lectura ${haceCuanto(hoy.ultimaLectura, ahora)} (${formatoFechaHora(hoy.ultimaLectura)}).`
              : "Sin lecturas todavía."}
          </p>
        </div>
        <BotonActualizar />
      </header>

      <section aria-labelledby="semana" className="flex flex-col gap-3">
        <h2 id="semana" className="text-base font-semibold">
          Últimos 7 días contra los 7 anteriores
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {hoy.tarjetas.map((t) => (
            <Card key={t.red}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {NOMBRE_RED[t.red]}
                  <span className="text-xs font-normal text-muted-foreground">
                    {t.publicacionesSemana} {t.publicacionesSemana === 1 ? "video" : "videos"} esta semana
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FilaSemana etiqueta="Vistas ganadas" datos={t.vistasGanadas} formato="entero" ahora={ahora} />
                <FilaSemana etiqueta="Tiempo promedio (% de la duración)" datos={t.tiempoPromedioPct} formato="porcentaje" ahora={ahora} />
                <FilaSemana etiqueta="% que pasa del segundo 3" datos={t.pctPasa3s} formato="porcentaje" ahora={ahora} />
                <FilaSemana etiqueta="Guardados + compartidos" datos={t.guardadosCompartidos} formato="entero" ahora={ahora} />
                <FilaSemana etiqueta="Seguidores nuevos" datos={t.seguidoresNuevos} formato="entero" ahora={ahora} />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Leads
              <Link href="/leads" className="text-xs font-normal text-muted-foreground underline">
                registrar
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FilaSemana etiqueta="Esta semana (lunes a domingo)" datos={hoy.leads} formato="entero" ahora={ahora} />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="salidas" className="flex flex-col gap-3">
        <h2 id="salidas" className="text-base font-semibold">
          Qué sale hoy y mañana
        </h2>
        {hoy.salidas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay publicaciones para hoy ni para mañana.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {hoy.salidas.map((s) => (
              <li key={s.clave}>
                <Card className="gap-3 py-4">
                  <CardHeader className="gap-1">
                    <CardTitle className="text-sm">
                      {s.reelId ? (
                        <Link href={`/videos/${encodeURIComponent(s.reelId)}`} className="underline-offset-4 hover:underline">
                          {s.reelId} · {s.gancho ?? "sin gancho"}
                        </Link>
                      ) : (
                        <>Sin reel · {s.gancho ?? "sin texto"}</>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {s.dia === "hoy" ? "Hoy" : "Mañana"} a las {formatoHora(s.primeraHora)}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {s.redes.map((r) => (
                        <li key={r.red} className="flex items-center gap-1.5 text-sm">
                          {NOMBRE_RED[r.red]} <span className="text-xs text-muted-foreground">{formatoHora(r.programadoPara)}</span>
                          <EstadoPublicacionBadge estado={r.estado} />
                        </li>
                      ))}
                    </ul>
                    {s.avisos.length > 0 && (
                      <ul className="list-disc pl-5 text-xs text-aviso">
                        {s.avisos.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="alertas" className="flex flex-col gap-3">
          <h2 id="alertas" className="text-base font-semibold">
            Alertas abiertas
          </h2>
          {hoy.alertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay alertas abiertas.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {hoy.alertas.map((a) => (
                <li key={a.id} className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
                  <Badge variant="outline" className={cn(a.nivel === "error" ? "border-malo/50 text-malo" : a.nivel === "aviso" ? "border-aviso/50 text-aviso" : "")}>
                    {a.nivel === "error" ? "Error" : a.nivel === "aviso" ? "Aviso" : "Info"}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    {a.mensaje}
                    <span className="block text-xs text-muted-foreground">{haceCuanto(a.creadaEn, ahora)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="mejor" className="flex flex-col gap-3">
          <h2 id="mejor" className="text-base font-semibold">
            Mejor video de los últimos 7 días
          </h2>
          {hoy.mejor === null ? (
            <p className="text-sm text-muted-foreground">Ningún video de la semana tiene vistas todavía.</p>
          ) : (
            <Card className="gap-3 py-4">
              <CardHeader className="gap-1">
                <CardTitle className="text-sm">
                  {hoy.mejor.reelId ? (
                    <Link href={`/videos/${encodeURIComponent(hoy.mejor.reelId)}`} className="underline-offset-4 hover:underline">
                      {hoy.mejor.reelId} · {hoy.mejor.gancho ?? "sin gancho"}
                    </Link>
                  ) : (
                    "Sin reel"
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">En {NOMBRE_RED[hoy.mejor.red]}</p>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Vistas</p>
                  <Cifra cifra={hoy.mejor.vistas} formato="entero" grande ahora={ahora} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tiempo promedio</p>
                  <Cifra cifra={hoy.mejor.tiempoPromedioS} formato="segundos" ahora={ahora} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">% que pasa del 3</p>
                  <Cifra cifra={hoy.mejor.pctPasa3s} formato="porcentaje" ahora={ahora} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Guardados</p>
                  <Cifra cifra={hoy.mejor.guardados} formato="entero" ahora={ahora} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Compartidos</p>
                  <Cifra cifra={hoy.mejor.compartidos} formato="entero" ahora={ahora} />
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
