"use client";
// Editar un borrador de Zernio (TikTok o Instagram): texto y fecha/hora de Bogotá -> revisar -> guardar.
// Sin confirmación no se envía nada. Tras revisar, los campos quedan bloqueados para que lo guardado sea lo mostrado.
import { Pencil } from "lucide-react";
import { useActionState, useState } from "react";
import { editarBorrador, type EstadoEdicion } from "@/app/(tablero)/cola/acciones";
import { Button } from "@/componentes/ui/button";

export function EditarBorrador({
  publicacionId,
  texto,
  dia,
  hora,
}: {
  publicacionId: number;
  texto: string;
  /** "AAAA-MM-DD" en Bogotá. */
  dia: string;
  /** "HH:MM" en Bogotá. */
  hora: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<EstadoEdicion, FormData>(editarBorrador, null);
  const [editando, setEditando] = useState(true);

  if (estado?.paso === "guardado") {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {estado.mensaje}
      </p>
    );
  }
  if (!abierto) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-8 w-fit" onClick={() => setAbierto(true)}>
        <Pencil className="size-3.5" aria-hidden /> Editar
      </Button>
    );
  }

  const revisado = estado?.paso === "revisado" && !editando;
  const campo = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm read-only:opacity-70";
  return (
    <form action={accion} className="flex flex-col gap-3 rounded-lg border p-3">
      <input type="hidden" name="publicacionId" value={publicacionId} />
      <label className="flex flex-col gap-1 text-xs font-medium">
        Texto
        <textarea name="texto" defaultValue={texto} readOnly={revisado} rows={6} maxLength={5000} className={campo} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Fecha (Bogotá)
          <input type="date" name="dia" defaultValue={dia} readOnly={revisado} required className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Hora (Bogotá)
          <input type="time" name="hora" defaultValue={hora} readOnly={revisado} required className={campo} />
        </label>
      </div>

      {revisado && (
        <div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm" role="status">
          <p className="font-medium">
            Se guardará como borrador en {estado.resumen.red}
            {estado.resumen.paraCuando ? `, para ${estado.resumen.paraCuando}` : ""}. No se publica.
          </p>
          <ul className="flex flex-col gap-2">
            {estado.resumen.cambios.map((c) => (
              <li key={c.campo} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-muted-foreground">{c.campo}</span>
                <span className="whitespace-pre-wrap break-words text-xs text-muted-foreground line-through">{c.antes}</span>
                <span className="whitespace-pre-wrap break-words">{c.despues}</span>
              </li>
            ))}
          </ul>
          <input type="hidden" name="confirmar" value="si" />
        </div>
      )}

      {estado?.paso === "error" && (
        <p role="alert" className="text-sm text-malo">
          {estado.mensaje}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {revisado ? (
          <>
            <Button type="submit" name="paso" value="guardar" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar borrador"}
            </Button>
            <Button type="button" variant="outline" disabled={pendiente} onClick={() => setEditando(true)}>
              Volver a editar
            </Button>
          </>
        ) : (
          <Button type="submit" name="paso" value="revisar" disabled={pendiente} onClick={() => setEditando(false)}>
            {pendiente ? "Revisando…" : "Revisar cambios"}
          </Button>
        )}
        <Button type="button" variant="ghost" disabled={pendiente} onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
