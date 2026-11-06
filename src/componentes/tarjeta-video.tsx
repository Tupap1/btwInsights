// Un reel como tarjeta (celular): los datos del video y, por red, las cifras a la vista con su fuente.
import Link from "next/link";
import { Cifra, type FormatoCifra } from "@/componentes/cifra";
import { NOMBRE_FORMATO, NOMBRE_RED, NOMBRE_VOZ } from "@/componentes/etiquetas";
import { formatoFechaCola } from "@/servidor/consultas/formato";
import { inicioDiaBogota } from "@/servidor/consultas/tiempo";
import type { FilaVideo, MetricaVideos } from "@/servidor/consultas/videos";
import type { Red } from "@/servidor/tipos";

export interface MetricaTarjeta {
  clave: MetricaVideos;
  texto: string;
  formato: FormatoCifra;
}

export function TarjetaVideo({
  fila,
  redes,
  metricas,
  mostrarIgFb,
  ahora,
}: {
  fila: FilaVideo;
  redes: readonly Red[];
  metricas: readonly MetricaTarjeta[];
  mostrarIgFb: boolean;
  ahora: Date;
}) {
  const detalle = [
    fila.fecha ? formatoFechaCola(inicioDiaBogota(fila.fecha)) : null,
    fila.reel.formato ? NOMBRE_FORMATO[fila.reel.formato] : null,
    fila.reel.voz ? NOMBRE_VOZ[fila.reel.voz] : null,
  ].filter((x): x is string => x !== null);
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-0">
        <Link href={`/videos/${encodeURIComponent(fila.reel.id)}`} className="font-medium underline-offset-4 hover:underline">
          {fila.reel.id}
        </Link>
        <p className="line-clamp-2 text-sm text-muted-foreground">{fila.reel.gancho ?? "sin gancho"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {detalle.join(" · ")}
          {!fila.publicado && " · sin publicar"}
        </p>
      </div>
      {redes.map((r) => {
        const celda = fila.redes[r];
        return (
          <div key={r} className="border-t pt-2">
            <p className="mb-1 text-xs font-medium">{NOMBRE_RED[r]}</p>
            {celda === null ? (
              <p className="text-xs text-muted-foreground">no publicado</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {metricas.map((m) => (
                  <div key={m.clave} className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[11px] text-muted-foreground">{m.texto}</span>
                    <Cifra
                      cifra={celda.cifras[m.clave]}
                      formato={m.formato}
                      aproxHoras={celda.aproxHoras[m.clave]}
                      comparacion={celda.comparacion[m.clave]}
                      ahora={ahora}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {mostrarIgFb && (
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-xs font-medium">IG + FB (vistas)</span>
          <Cifra cifra={fila.igfb} formato="entero" alinear="derecha" etiqueta="IG + FB" ahora={ahora} />
        </div>
      )}
    </li>
  );
}
