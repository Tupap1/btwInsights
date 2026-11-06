import { textoCifra, type FormatoCifra } from "@/componentes/cifra";
import { NOMBRE_FORMATO, NOMBRE_RED, NOMBRE_VOZ } from "@/componentes/etiquetas";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { exigirSesion } from "@/servidor/acceso/sesion";
import {
  MINIMO_VIDEOS,
  consultarAprendizajes,
  type CeldaGrupo,
  type Dimension,
  type Grupo,
  type MedianaGrupo,
} from "@/servidor/consultas/aprendizajes";
import { REDES } from "@/servidor/consultas/datos";
import { formatoEntero, NOMBRE_FUENTE } from "@/servidor/consultas/formato";
import { bd } from "@/servidor/db/cliente";
import type { Formato, Voz } from "@/servidor/tipos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aprendizajes · BTW Insights" };

const TITULO: Record<Dimension, string> = {
  gancho: "Por gancho",
  formato: "Por formato",
  voz: "Por voz",
  variables: "Por variable probada",
};

const METRICAS: { clave: "vistas" | "tiempoPct" | "pasa3s" | "guardadosCompartidos"; texto: string; formato: FormatoCifra }[] = [
  { clave: "vistas", texto: "Vistas", formato: "entero" },
  { clave: "tiempoPct", texto: "Tiempo prom. (% de la duración)", formato: "porcentaje" },
  { clave: "pasa3s", texto: "% pasa del seg. 3", formato: "porcentaje" },
  { clave: "guardadosCompartidos", texto: "Guardados + compartidos", formato: "entero" },
];

/** Los valores guardados de formato y voz salen con su nombre en español. */
function etiquetaDe(dim: Dimension, g: Grupo): string {
  if (dim === "formato" && g.clave in NOMBRE_FORMATO) return NOMBRE_FORMATO[g.clave as Formato];
  if (dim === "voz" && g.clave in NOMBRE_VOZ) return NOMBRE_VOZ[g.clave as Voz];
  return g.etiqueta;
}

function Metrica({ texto, formato, m, n }: { texto: string; formato: FormatoCifra; m: MedianaGrupo; n: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{texto}</dt>
      <dd className="flex flex-col gap-0.5">
        <span className="text-base font-semibold tabular-nums" title={m.mediana === null ? "sin dato" : undefined}>
          {textoCifra(m.mediana, formato)}
        </span>
        <span className="text-[10px] leading-4 text-muted-foreground">
          {m.mediana === null
            ? "sin dato"
            : `mediana de ${formatoEntero(m.conDato)} de ${formatoEntero(n)} · ${m.fuentes.map((f) => NOMBRE_FUENTE[f]).join(" + ")}`}
        </span>
      </dd>
    </div>
  );
}

function BloqueRed({ nombre, c }: { nombre: string; c: CeldaGrupo }) {
  return (
    <div className="flex flex-col gap-2 border-t pt-2 first:border-t-0 first:pt-0">
      <p className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
        {nombre}
        <span className="text-xs font-normal text-muted-foreground">
          {c.n === 0 ? "sin videos con lectura a 48 h" : `${formatoEntero(c.n)} ${c.n === 1 ? "video" : "videos"} (n)`}
        </span>
        {c.n > 0 && c.pocosDatos && (
          <span
            className="rounded border border-aviso/50 px-1 text-[10px] leading-4 text-aviso"
            title={`Con menos de ${MINIMO_VIDEOS} videos no se saca conclusión`}
          >
            pocos datos
          </span>
        )}
      </p>
      {c.n > 0 && !c.pocosDatos && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          {METRICAS.map((x) => (
            <Metrica key={x.clave} texto={x.texto} formato={x.formato} m={c[x.clave]} n={c.n} />
          ))}
        </dl>
      )}
    </div>
  );
}

export default async function PaginaAprendizajes() {
  await exigirSesion();
  const datos = await consultarAprendizajes(bd());

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Qué funciona</h1>
        <p className="text-sm text-muted-foreground">
          Medianas a las 48 h de la publicación (la lectura más cercana, a no más de 12 h), por grupo y red. Solo
          conteos y medianas: con menos de {MINIMO_VIDEOS} videos no se saca conclusión.
        </p>
      </header>

      {(Object.keys(TITULO) as Dimension[]).map((dim) => (
        <section key={dim} className="flex flex-col gap-3" aria-labelledby={`h-${dim}`}>
          <h2 id={`h-${dim}`} className="text-base font-semibold">
            {TITULO[dim]}
          </h2>
          {datos[dim].length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay videos con lectura a 48 h.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {datos[dim].map((g) => (
                <li key={g.clave}>
                  <Card className="h-full gap-3 py-4">
                    <CardHeader className="gap-0">
                      <CardTitle className="text-sm break-words">{etiquetaDe(dim, g)}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {REDES.map((red) => (
                        <BloqueRed key={red} nombre={NOMBRE_RED[red]} c={g.redes[red]} />
                      ))}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
