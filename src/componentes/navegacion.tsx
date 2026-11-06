"use client";
// Navegación: barra fija abajo en el celular y arriba en pantallas anchas.
import { CalendarDays, Film, Home, Inbox } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ENLACES = [
  { href: "/hoy", texto: "Hoy", icono: Home },
  { href: "/videos", texto: "Videos", icono: Film },
  { href: "/cola", texto: "Cola", icono: CalendarDays },
  { href: "/sin-asignar", texto: "Sin asignar", icono: Inbox },
] as const;

export function Navegacion() {
  const ruta = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card md:sticky md:top-0 md:bottom-auto md:border-t-0 md:border-b"
    >
      <ul className="mx-auto flex max-w-6xl items-stretch justify-around md:justify-start md:gap-1 md:px-4">
        <li className="hidden items-center pr-4 text-sm font-semibold md:flex">BTW Insights</li>
        {ENLACES.map(({ href, texto, icono: Icono }) => {
          const activo = ruta === href || ruta.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 px-3 text-xs text-muted-foreground md:h-12 md:flex-row md:gap-2 md:text-sm",
                  activo && "font-semibold text-foreground",
                )}
              >
                <Icono className="size-5 md:size-4" aria-hidden />
                {texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
