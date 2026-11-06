"use client";
// "Pasar a reel": pide el id del reel nuevo y una confirmación explícita antes de crearlo.
import { useActionState } from "react";
import { pasarIdeaAReel, type EstadoPasar } from "@/app/(tablero)/ideas/acciones";
import { Button } from "@/componentes/ui/button";

export function FormularioPasarAReel({ ideaId }: { ideaId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoPasar, FormData>(pasarIdeaAReel, null);
  return (
    <details className="rounded-md border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Pasar a reel</summary>
      <form action={accion} className="flex flex-col gap-3 border-t p-3">
        <input type="hidden" name="ideaId" value={ideaId} />
        <label className="flex flex-col gap-1.5 text-sm">
          Id del reel nuevo (por ejemplo 23)
          <input
            name="reelId"
            required
            maxLength={32}
            autoComplete="off"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Crea el reel en el tablero con estado “idea” y une esta idea a él. No se publica nada.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pendiente}>
            {pendiente ? "Creando…" : "Confirmar y crear el reel"}
          </Button>
          {estado && (
            <p role="status" className={estado.ok ? "text-sm text-muted-foreground" : "text-sm text-malo"}>
              {estado.mensaje}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
