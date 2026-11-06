"use client";
// Cierra la sesión y vuelve a /entrar.
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function BotonSalir({ className }: Readonly<{ className?: string }>) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  async function salir() {
    setOcupado(true);
    try {
      await fetch("/api/acceso/salir", { method: "POST" });
    } finally {
      router.replace("/entrar");
      router.refresh();
    }
  }
  return (
    <button
      type="button"
      onClick={salir}
      disabled={ocupado}
      className={cn(
        "flex h-14 w-full flex-col items-center justify-center gap-0.5 px-3 text-xs text-muted-foreground disabled:opacity-50 md:h-12 md:flex-row md:gap-2 md:text-sm",
        className,
      )}
    >
      <LogOut className="size-5 md:size-4" aria-hidden />
      Salir
    </button>
  );
}
