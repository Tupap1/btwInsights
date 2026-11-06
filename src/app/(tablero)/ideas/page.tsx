import Link from "next/link";
import { NOMBRE_FORMATO } from "@/componentes/etiquetas";
import { FormularioPasarAReel } from "@/componentes/formulario-pasar-a-reel";
import { cn } from "@/lib/utils";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { consultarIdeas, FORMATOS_IDEA, leerFiltrosIdeas, type FiltrosIdeas } from "@/servidor/consultas/ideas";
import { bd } from "@/servidor/db/cliente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ideas · BTW Insights" };

const NOMBRE_ESTADO: Record<string, string> = { nueva: "Nueva", en_reel: "En un reel" };

function enlace(f: FiltrosIdeas, cambios: Partial<FiltrosIdeas>): string {
  const u = new URLSearchParams();
  const m = { ...f, ...cambios };
  if (m.estado) u.set("estado", m.estado);
  if (m.formato) u.set("formato", m.formato);
  const q = u.toString();
  return q ? `/ideas?${q}` : "/ideas";
}

function Chip({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={activo ? "true" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-sm",
        activo ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export default async function PaginaIdeas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const filtros = leerFiltrosIdeas(await searchParams);
  const { ideas, total, estados } = await consultarIdeas(bd(), filtros);
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">Ideas</h1>
        <p className="text-sm text-muted-foreground">
          {ideas.length} de {total} ideas, de mayor a menor puntaje (sobre 12). Las que no tienen puntaje van al final.
        </p>
      </header>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" aria-label="Filtrar por estado">
          <Chip href={enlace(filtros, { estado: undefined })} activo={!filtros.estado}>
            Todos los estados
          </Chip>
          {estados.map((e) => (
            <Chip key={e} href={enlace(filtros, { estado: e })} activo={filtros.estado === e}>
              {NOMBRE_ESTADO[e] ?? e}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filtrar por formato">
          <Chip href={enlace(filtros, { formato: undefined })} activo={!filtros.formato}>
            Todos los formatos
          </Chip>
          {FORMATOS_IDEA.map((f) => (
            <Chip key={f} href={enlace(filtros, { formato: f })} activo={filtros.formato === f}>
              {NOMBRE_FORMATO[f]}
            </Chip>
          ))}
        </div>
      </div>
      {ideas.length === 0 ? (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          No hay ideas con estos filtros. Las ideas entran con <code>npm run importar</code>.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ideas.map((i) => (
            <li key={i.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 font-medium">{i.titulo}</h2>
                <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-sm tabular-nums" title="Puntaje sobre 12">
                  {i.puntaje === null ? "sin puntaje" : `${i.puntaje}/12`}
                </span>
              </div>
              {i.gancho && <p className="text-sm">{i.gancho}</p>}
              <dl className="grid gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="inline">Formato: </dt>
                  <dd className="inline">{i.formato ? NOMBRE_FORMATO[i.formato] : "sin definir"}</dd>
                </div>
                <div>
                  <dt className="inline">Estado: </dt>
                  <dd className="inline">{NOMBRE_ESTADO[i.estado] ?? i.estado}</dd>
                </div>
                {i.funcionBtwash && (
                  <div className="sm:col-span-2">
                    <dt className="inline">Función de BTWash: </dt>
                    <dd className="inline">{i.funcionBtwash}</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="inline">Fuente: </dt>
                  <dd className="inline break-all">{i.fuente ?? "manual"}</dd>
                </div>
              </dl>
              {i.reelId ? (
                <p className="text-sm">
                  Pasó al reel{" "}
                  <Link href={`/videos/${encodeURIComponent(i.reelId)}`} className="underline underline-offset-4">
                    {i.reelId}
                  </Link>
                  .
                </p>
              ) : (
                <FormularioPasarAReel ideaId={i.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
