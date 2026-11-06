"use client";
// Navegación: barra fija abajo en el celular y arriba en pantallas anchas. Hasta lg solo caben las principales y
// "Más" (que lleva a /mas con las demás y Salir); desde lg van todas.
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BotonSalir } from "@/componentes/boton-salir";
import { ENLACES_PRINCIPALES, ENLACES_SECUNDARIOS, type Enlace } from "@/componentes/enlaces";
import { cn } from "@/lib/utils";

const CLASE_ENLACE =
  "flex h-14 flex-col items-center justify-center gap-0.5 px-3 text-xs text-muted-foreground md:h-12 md:flex-row md:gap-2 md:text-sm";

function Item({ enlace, activo, className }: Readonly<{ enlace: Enlace; activo: boolean; className?: string }>) {
  const { href, texto, icono: Icono } = enlace;
  return (
    <li className={cn("flex-1 md:flex-none", className)}>
      <Link href={href} aria-current={activo ? "page" : undefined} className={cn(CLASE_ENLACE, activo && "font-semibold text-foreground")}>
        <Icono className="size-5 md:size-4" aria-hidden />
        {texto}
      </Link>
    </li>
  );
}

export function Navegacion() {
  const ruta = usePathname();
  const activo = (href: string) => ruta === href || ruta.startsWith(`${href}/`);
  const enSecundaria = ENLACES_SECUNDARIOS.some((e) => activo(e.href)) || activo("/mas");
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card md:sticky md:top-0 md:bottom-auto md:border-t-0 md:border-b"
    >
      <ul className="mx-auto flex max-w-6xl items-stretch justify-around md:justify-start md:gap-1 md:px-4">
        <li className="hidden items-center pr-4 text-sm font-semibold md:flex">BTW Insights</li>
        {ENLACES_PRINCIPALES.map((e) => (
          <Item key={e.href} enlace={e} activo={activo(e.href)} />
        ))}
        {ENLACES_SECUNDARIOS.map((e) => (
          <Item key={e.href} enlace={e} activo={activo(e.href)} className="hidden lg:block" />
        ))}
        <Item
          enlace={{ href: "/mas", texto: "Más", icono: Ellipsis, descripcion: "" }}
          activo={enSecundaria}
          className="lg:hidden"
        />
        <li className="hidden lg:ml-auto lg:block">
          <BotonSalir />
        </li>
      </ul>
    </nav>
  );
}
