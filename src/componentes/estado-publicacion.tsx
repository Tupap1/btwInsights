import { Badge } from "@/componentes/ui/badge";
import { NOMBRE_ESTADO } from "@/componentes/etiquetas";
import { cn } from "@/lib/utils";
import type { EstadoPublicacion } from "@/servidor/tipos";

const CLASE: Partial<Record<EstadoPublicacion, string>> = {
  publicado: "border-bueno/40 text-bueno",
  programado: "border-border text-foreground",
  fallido: "border-malo/50 text-malo",
  borrador: "border-aviso/50 text-aviso",
  pendiente_aprobacion: "border-aviso/50 text-aviso",
  parcial: "border-aviso/50 text-aviso",
};

export function EstadoPublicacionBadge({ estado }: { estado: EstadoPublicacion }) {
  return (
    <Badge variant="outline" className={cn("font-normal", CLASE[estado])}>
      {NOMBRE_ESTADO[estado]}
    </Badge>
  );
}
