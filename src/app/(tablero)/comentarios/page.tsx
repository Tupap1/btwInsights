import Link from "next/link";
import { TarjetaComentario } from "@/componentes/tarjeta-comentario";
import { cn } from "@/lib/utils";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { consultarComentarios, leerVer } from "@/servidor/consultas/comentarios";
import { haceCuanto } from "@/servidor/consultas/formato";
import { ahoraServidor } from "@/servidor/consultas/tiempo";
import { bd } from "@/servidor/db/cliente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comentarios · BTW Insights" };

export default async function PaginaComentarios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const ver = leerVer((await searchParams)["ver"]);
  const ahora = ahoraServidor();
  const v = await consultarComentarios(bd(), ver);

  const pestana = (activa: boolean) =>
    cn(
      "rounded-md border px-3 py-1.5 text-sm",
      activa ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">Comentarios</h1>
        <p className="text-sm text-muted-foreground">
          {v.ultimaLectura
            ? `Zernio (Instagram y TikTok), leído ${haceCuanto(v.ultimaLectura, ahora)}.`
            : "Zernio (Instagram y TikTok). Todavía no se ha leído ningún hilo."}
        </p>
        <p className="text-xs text-muted-foreground">Se guardan el texto y el @ de quien comenta; no el nombre ni la foto.</p>
      </header>

      <nav aria-label="Vista" className="flex gap-2">
        <Link href="/comentarios" className={pestana(ver === "sin_responder")} aria-current={ver === "sin_responder" ? "page" : undefined}>
          Sin responder ({v.sinResponder})
        </Link>
        <Link href="/comentarios?ver=todos" className={pestana(ver === "todos")} aria-current={ver === "todos" ? "page" : undefined}>
          Todos ({v.total})
        </Link>
      </nav>

      {v.comentarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {ver === "sin_responder" ? "No hay comentarios sin responder." : "Todavía no hay comentarios de otras personas."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {v.comentarios.map((c) => (
            <TarjetaComentario key={c.id} comentario={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
