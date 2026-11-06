"use client";
// Asignar una publicación sin reel a un reel (queda con emparejadoPor = "manual").
import { useActionState, useState } from "react";
import { asignarPublicacion, type EstadoAccion } from "@/app/(tablero)/acciones";
import { Button } from "@/componentes/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/componentes/ui/select";

export function FormularioAsignar({
  publicacionId,
  reels,
}: {
  publicacionId: number;
  reels: { id: string; gancho: string | null }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(asignarPublicacion, null);
  const [reelId, setReelId] = useState<string>("");
  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="publicacionId" value={publicacionId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select name="reelId" value={reelId} onValueChange={setReelId}>
          <SelectTrigger className="w-full sm:w-72" aria-label="Reel">
            <SelectValue placeholder="Escoge un reel" />
          </SelectTrigger>
          <SelectContent>
            {reels.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.id}
                {r.gancho ? ` · ${r.gancho.slice(0, 40)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={pendiente || reelId === ""}>
          {pendiente ? "Asignando…" : "Asignar"}
        </Button>
      </div>
      {estado && (
        <p role="status" className={estado.ok ? "text-sm text-muted-foreground" : "text-sm text-malo"}>
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
