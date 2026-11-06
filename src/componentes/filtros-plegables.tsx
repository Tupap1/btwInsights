"use client";
// Los filtros de /videos: plegados en el celular (< md) y siempre abiertos en escritorio.
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function FiltrosPlegables({ children, activos }: { children: ReactNode; activos: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const ajustar = () => {
      if (ref.current && mq.matches) ref.current.open = true;
    };
    ajustar();
    mq.addEventListener("change", ajustar);
    return () => mq.removeEventListener("change", ajustar);
  }, []);
  return (
    <details ref={ref} open={activos} className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium md:hidden [&::-webkit-details-marker]:hidden">
        <span>Filtros{activos ? " (activos)" : ""}</span>
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="p-3 md:pt-3">{children}</div>
    </details>
  );
}
