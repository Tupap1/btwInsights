"use client";
// "Actualizar ahora": pide una lectura nueva a Zernio y Meta (solo GET) y muestra el resumen.
import { RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { actualizarAhora, type EstadoAccion } from "@/app/(tablero)/acciones";
import { Button } from "@/componentes/ui/button";

export function BotonActualizar() {
  const [estado, accion, pendiente] = useActionState<EstadoAccion>(actualizarAhora, null);
  return (
    <form action={accion} className="flex flex-col gap-2">
      <Button type="submit" variant="outline" disabled={pendiente}>
        <RefreshCw className={pendiente ? "animate-spin" : undefined} aria-hidden />
        {pendiente ? "Actualizando…" : "Actualizar ahora"}
      </Button>
      {estado && (
        <p role="status" className={estado.ok ? "text-sm text-muted-foreground" : "text-sm text-malo"}>
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
