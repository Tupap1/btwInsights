import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { Cifra, type FormatoCifra } from "@/componentes/cifra";
import {
  NOMBRE_FORMATO,
  NOMBRE_MOMENTO,
  NOMBRE_RED,
  NOMBRE_VOZ,
} from "@/componentes/etiquetas";
import { FiltrosPlegables } from "@/componentes/filtros-plegables";
import { TarjetaVideo } from "@/componentes/tarjeta-video";
import { Button } from "@/componentes/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/componentes/ui/table";
import { cn } from "@/lib/utils";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { bd } from "@/servidor/db/cliente";
import { REDES } from "@/servidor/consultas/datos";
import { formatoFechaCola } from "@/servidor/consultas/formato";
import { ahoraServidor, inicioDiaBogota } from "@/servidor/consultas/tiempo";
import {
  MOMENTOS,
  consultarVideos,
  leerFiltros,
  type ClaveOrden,
  type FiltrosVideos,
  type MetricaVideos,
} from "@/servidor/consultas/videos";
import type { Red } from "@/servidor/tipos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Videos · BTW Insights" };

const TODOS = "todos";
const METRICAS: {
  clave: MetricaVideos;
  texto: string;
  formato: FormatoCifra;
}[] = [
  { clave: "vistas", texto: "Vistas", formato: "entero" },
  { clave: "tiempoPromedioS", texto: "Tiempo prom.", formato: "segundos" },
  { clave: "pctCompleto", texto: "% completo", formato: "porcentaje" },
  { clave: "pctPasa3s", texto: "% pasa 3 s", formato: "porcentaje" },
];

/** La URL de /videos con los filtros actuales y los cambios que se pidan. */
function enlace(
  f: FiltrosVideos,
  cambios: Partial<Record<keyof FiltrosVideos, string | undefined>>,
): string {
  const actuales: Record<string, string | undefined> = {
    momento: f.momento === "ultima" ? undefined : f.momento,
    formato: f.formato,
    voz: f.voz,
    red: f.red,
    desde: f.desde,
    hasta: f.hasta,
    orden: f.orden === "fecha" ? undefined : f.orden,
    dir: f.orden === "fecha" && f.dir === "desc" ? undefined : f.dir,
  };
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...actuales, ...cambios }))
    if (v) u.set(k, v);
  const q = u.toString();
  return q ? `/videos?${q}` : "/videos";
}

function EncabezadoOrden({
  f,
  clave,
  texto,
  alinear,
}: {
  f: FiltrosVideos;
  clave: ClaveOrden;
  texto: string;
  alinear?: "der";
}) {
  const activo = f.orden === clave;
  const siguiente = activo && f.dir === "desc" ? "asc" : "desc";
  return (
    <Link
      href={enlace(f, { orden: clave, dir: siguiente })}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap",
        alinear === "der" && "justify-end",
        activo && "text-foreground",
      )}
      aria-label={`Ordenar por ${texto}`}
    >
      {texto}
      {activo &&
        (f.dir === "desc" ? (
          <ArrowDown className="size-3" aria-hidden />
        ) : (
          <ArrowUp className="size-3" aria-hidden />
        ))}
    </Link>
  );
}

export default async function PaginaVideos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const filtros = leerFiltros(await searchParams);
  const ahora = ahoraServidor();
  const { filas, total } = await consultarVideos(bd(), filtros);
  const redes: readonly Red[] = filtros.red ? [filtros.red] : REDES;
  const hayFiltros = !!(
    filtros.formato ||
    filtros.voz ||
    filtros.red ||
    filtros.desde ||
    filtros.hasta
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">Videos</h1>
        <p className="text-sm text-muted-foreground">
          {filas.length} de {total} reels. Colores contra la mediana de los
          últimos 10 de cada red.
        </p>
      </header>

      <nav
        aria-label="Momento de las cifras"
        className="flex gap-1 rounded-lg bg-muted p-1 text-sm"
      >
        {MOMENTOS.map((m) => (
          <Link
            key={m}
            href={enlace(filtros, { momento: m === "ultima" ? undefined : m })}
            aria-current={filtros.momento === m ? "true" : undefined}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-center text-muted-foreground",
              filtros.momento === m &&
                "bg-card font-semibold text-foreground shadow-xs",
            )}
          >
            {NOMBRE_MOMENTO[m]}
          </Link>
        ))}
      </nav>

      <FiltrosPlegables activos={hayFiltros}>
        <form
          method="get"
          action="/videos"
          className="grid grid-cols-2 gap-3 md:grid-cols-6 md:items-end"
        >
          <input type="hidden" name="momento" value={filtros.momento} />
          <input type="hidden" name="orden" value={filtros.orden} />
          <input type="hidden" name="dir" value={filtros.dir} />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Formato
            <Select name="formato" defaultValue={filtros.formato ?? TODOS}>
              <SelectTrigger className="w-full" aria-label="Formato">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {Object.entries(NOMBRE_FORMATO).map(([v, n]) => (
                  <SelectItem key={v} value={v}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Voz
            <Select name="voz" defaultValue={filtros.voz ?? TODOS}>
              <SelectTrigger className="w-full" aria-label="Voz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {Object.entries(NOMBRE_VOZ).map(([v, n]) => (
                  <SelectItem key={v} value={v}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Red
            <Select name="red" defaultValue={filtros.red ?? TODOS}>
              <SelectTrigger className="w-full" aria-label="Red">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {REDES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {NOMBRE_RED[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Desde
            <input
              type="date"
              name="desde"
              defaultValue={filtros.desde ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Hasta
            <input
              type="date"
              name="hasta"
              defaultValue={filtros.hasta ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
            />
          </label>
          <div className="col-span-2 flex gap-2 md:col-span-1">
            <Button type="submit" className="flex-1">
              Filtrar
            </Button>
            {hayFiltros && (
              <Button asChild variant="outline">
                <Link
                  href={enlace(
                    {
                      ...filtros,
                      formato: undefined,
                      voz: undefined,
                      red: undefined,
                      desde: undefined,
                      hasta: undefined,
                    },
                    {},
                  )}
                >
                  Limpiar
                </Link>
              </Button>
            )}
          </div>
        </form>
      </FiltrosPlegables>

      {filas.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Ningún reel cumple esos filtros.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {filas.map((fila) => (
              <TarjetaVideo
                key={fila.reel.id}
                fila={fila}
                redes={redes}
                metricas={METRICAS}
                mostrarIgFb={!filtros.red}
                ahora={ahora}
              />
            ))}
          </ul>
          <div className="hidden rounded-lg border bg-card md:block">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow>
                  <TableHead
                    rowSpan={2}
                    className="sticky left-0 z-10 min-w-48 bg-card align-middle"
                  >
                    <EncabezadoOrden f={filtros} clave="gancho" texto="Video" />
                  </TableHead>
                  <TableHead rowSpan={2} className="align-middle">
                    <EncabezadoOrden f={filtros} clave="fecha" texto="Fecha" />
                  </TableHead>
                  <TableHead rowSpan={2} className="align-middle">
                    <EncabezadoOrden
                      f={filtros}
                      clave="formato"
                      texto="Formato"
                    />
                  </TableHead>
                  <TableHead rowSpan={2} className="align-middle">
                    <EncabezadoOrden f={filtros} clave="voz" texto="Voz" />
                  </TableHead>
                  {redes.map((r) => (
                    <TableHead
                      key={r}
                      colSpan={4}
                      className="border-l text-center text-foreground"
                    >
                      {NOMBRE_RED[r]}
                    </TableHead>
                  ))}
                  {!filtros.red && (
                    <TableHead
                      rowSpan={2}
                      className="border-l text-right align-middle"
                    >
                      <EncabezadoOrden
                        f={filtros}
                        clave="igfb"
                        texto="IG + FB"
                        alinear="der"
                      />
                    </TableHead>
                  )}
                </TableRow>
                <TableRow>
                  {redes.flatMap((r) =>
                    METRICAS.map((m, i) => (
                      <TableHead
                        key={`${r}-${m.clave}`}
                        className={cn("text-right", i === 0 && "border-l")}
                      >
                        <EncabezadoOrden
                          f={filtros}
                          clave={`${r}_${m.clave}`}
                          texto={m.texto}
                          alinear="der"
                        />
                      </TableHead>
                    )),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((fila) => (
                  <TableRow key={fila.reel.id}>
                    <TableCell className="sticky left-0 z-10 max-w-64 bg-card whitespace-normal">
                      <Link
                        href={`/videos/${encodeURIComponent(fila.reel.id)}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {fila.reel.id}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {fila.reel.gancho ?? "sin gancho"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {fila.fecha
                        ? formatoFechaCola(inicioDiaBogota(fila.fecha))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {fila.reel.formato
                        ? NOMBRE_FORMATO[fila.reel.formato]
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {fila.reel.voz ? NOMBRE_VOZ[fila.reel.voz] : "—"}
                    </TableCell>
                    {redes.flatMap((r) => {
                      const celda = fila.redes[r];
                      return METRICAS.map((m, i) =>
                        celda === null ? (
                          <TableCell
                            key={`${r}-${m.clave}`}
                            className={cn(
                              "text-right text-xs text-muted-foreground",
                              i === 0 && "border-l",
                            )}
                            title="Sin publicación en esta red"
                          >
                            {i === 0 ? "no publicado" : ""}
                          </TableCell>
                        ) : (
                          <TableCell
                            key={`${r}-${m.clave}`}
                            className={cn("text-right", i === 0 && "border-l")}
                          >
                            <Cifra
                              cifra={celda.cifras[m.clave]}
                              formato={m.formato}
                              alinear="derecha"
                              aproxHoras={celda.aproxHoras[m.clave]}
                              comparacion={celda.comparacion[m.clave]}
                              ahora={ahora}
                            />
                          </TableCell>
                        ),
                      );
                    })}
                    {!filtros.red && (
                      <TableCell className="border-l text-right">
                        <Cifra
                          cifra={fila.igfb}
                          formato="entero"
                          alinear="derecha"
                          etiqueta="IG + FB"
                          ahora={ahora}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
