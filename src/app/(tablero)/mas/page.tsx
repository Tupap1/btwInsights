// /mas: las pantallas que no caben en la barra del celular, y Salir.
import Link from "next/link";
import { BotonSalir } from "@/componentes/boton-salir";
import { ENLACES_SECUNDARIOS } from "@/componentes/enlaces";
import { exigirSesion } from "@/servidor/acceso/sesion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Más · BTW Insights" };

export default async function PaginaMas() {
  await exigirSesion();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Más</h1>
      <ul className="flex flex-col gap-2">
        {ENLACES_SECUNDARIOS.map(({ href, texto, icono: Icono, descripcion }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <Icono className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{texto}</span>
                <span className="block text-xs text-muted-foreground">{descripcion}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="rounded-lg border bg-card">
        <BotonSalir className="h-12 flex-row gap-2 text-sm" />
      </div>
    </div>
  );
}
