"use client";
// Registro manual de un lead: celular primero (una columna, controles grandes). Sin datos personales.
import { useActionState } from "react";
import { registrarLead, type EstadoLead } from "@/app/(tablero)/leads/acciones";
import { Button } from "@/componentes/ui/button";
import { NOMBRE_CANAL, NOMBRE_RESULTADO } from "@/componentes/etiquetas-leads";
import { CANALES, MAX_NOTA, RESULTADOS } from "@/servidor/leads/esquema";

const CAMPO = "h-10 w-full rounded-md border bg-background px-3 text-base sm:text-sm";

export function FormularioLead({
  hoy,
  reels,
}: {
  /** "AAAA-MM-DD" de hoy en Bogotá: fecha inicial y tope. */
  hoy: string;
  reels: { id: string; gancho: string | null }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoLead, FormData>(registrarLead, null);
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Fecha
        <input type="date" name="fecha" defaultValue={hoy} max={hoy} required className={CAMPO} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Canal
        <select name="canal" required defaultValue="" className={CAMPO}>
          <option value="" disabled>
            Escoge un canal
          </option>
          {CANALES.map((c) => (
            <option key={c} value={c}>
              {NOMBRE_CANAL[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Reel (opcional)
        <select name="reelId" defaultValue="" className={CAMPO}>
          <option value="">Ninguno</option>
          {reels.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id}
              {r.gancho ? ` · ${r.gancho.slice(0, 40)}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Resultado (opcional)
        <select name="resultado" defaultValue="" className={CAMPO}>
          <option value="">Sin resultado todavía</option>
          {RESULTADOS.map((r) => (
            <option key={r} value={r}>
              {NOMBRE_RESULTADO[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Nota (opcional)
        <textarea name="nota" rows={3} maxLength={MAX_NOTA} className="w-full rounded-md border bg-background px-3 py-2 text-base sm:text-sm" />
        <span className="text-xs font-medium text-aviso">No escribas nombres ni teléfonos.</span>
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Button type="submit" disabled={pendiente} className="h-10 w-full sm:w-auto sm:self-start">
          {pendiente ? "Guardando…" : "Registrar lead"}
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
