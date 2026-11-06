"use client";
// Notas, formato y voz de un reel. Es lo único que se edita en el detalle.
import { useActionState } from "react";
import { guardarReel, type EstadoAccion } from "@/app/(tablero)/acciones";
import { NOMBRE_FORMATO, NOMBRE_VOZ } from "@/componentes/etiquetas";
import { Button } from "@/componentes/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/componentes/ui/select";
import type { Formato, Voz } from "@/servidor/tipos";

const SIN_DEFINIR = "sin_definir";

export function FormularioReel({
  reelId,
  notas,
  formato,
  voz,
}: {
  reelId: string;
  notas: string | null;
  formato: Formato | null;
  voz: Voz | null;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(guardarReel, null);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="reelId" value={reelId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          Formato
          <Select name="formato" defaultValue={formato ?? SIN_DEFINIR}>
            <SelectTrigger className="w-full" aria-label="Formato">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_DEFINIR}>Sin definir</SelectItem>
              {Object.entries(NOMBRE_FORMATO).map(([valor, nombre]) => (
                <SelectItem key={valor} value={valor}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Voz
          <Select name="voz" defaultValue={voz ?? SIN_DEFINIR}>
            <SelectTrigger className="w-full" aria-label="Voz">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_DEFINIR}>Sin definir</SelectItem>
              {Object.entries(NOMBRE_VOZ).map(([valor, nombre]) => (
                <SelectItem key={valor} value={valor}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        Notas y aprendizajes
        <textarea
          name="notas"
          defaultValue={notas ?? ""}
          rows={6}
          maxLength={20000}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </Button>
        {estado && (
          <p role="status" className={estado.ok ? "text-sm text-muted-foreground" : "text-sm text-malo"}>
            {estado.mensaje}
          </p>
        )}
      </div>
    </form>
  );
}
