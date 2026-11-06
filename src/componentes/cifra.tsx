// La única forma de pintar una métrica: el valor, con un chip de su fuente y su antigüedad ("Meta · hace 3 h").
// Sin dato muestra "—" con el title "sin dato". Nunca un 0 en su lugar.
import { cn } from "@/lib/utils";
import type { Cifra as CifraDato } from "@/servidor/consultas/cifras";
import type { Comparacion } from "@/servidor/consultas/estadistica";
import {
  NOMBRE_FUENTE,
  formatoDecimal,
  formatoEntero,
  formatoPesos,
  formatoPorcentaje,
  formatoSegundos,
  haceCuanto,
} from "@/servidor/consultas/formato";
import { ahoraServidor } from "@/servidor/consultas/tiempo";
import type { Fuente } from "@/servidor/tipos";

export type FormatoCifra = "entero" | "decimal" | "porcentaje" | "segundos" | "pesos";

const FORMATEAR: Record<FormatoCifra, (n: number) => string> = {
  entero: formatoEntero,
  decimal: formatoDecimal,
  porcentaje: formatoPorcentaje,
  segundos: formatoSegundos,
  pesos: formatoPesos,
};

export function textoCifra(valor: number | null, formato: FormatoCifra): string {
  return valor === null ? "—" : FORMATEAR[formato](valor);
}

/** Chip chico con la fuente y cuándo estaba vigente el dato. */
export function ChipFuente({
  fuente,
  datoActualizadoEn,
  etiqueta,
  aproxHoras,
  ahora,
}: {
  fuente: Fuente;
  datoActualizadoEn: Date | null;
  /** Reemplaza el nombre de la fuente (p. ej. "IG + FB"). */
  etiqueta?: string;
  /** Horas reales cuando la lectura está a más de 12 h del momento pedido. */
  aproxHoras?: number;
  ahora?: Date;
}) {
  const reloj = ahora ?? ahoraServidor();
  const nombre = etiqueta ?? NOMBRE_FUENTE[fuente];
  const edad = datoActualizadoEn ? haceCuanto(datoActualizadoEn, reloj) : "sin fecha";
  const aprox = aproxHoras !== undefined ? ` · aprox. a las ${formatoEntero(Math.round(aproxHoras))} h` : "";
  return (
    <span
      className={cn(
        "inline-block rounded bg-muted px-1.5 py-px text-[10px] leading-4 whitespace-nowrap text-muted-foreground",
        fuente === "manual" && "text-aviso",
      )}
      title={`Fuente: ${nombre}. Dato vigente ${edad}${aprox}.`}
    >
      {nombre} · {edad}
      {aprox}
    </span>
  );
}

export function Cifra({
  cifra,
  formato,
  grande = false,
  etiqueta,
  aproxHoras,
  comparacion,
  alinear = "izquierda",
  ahora,
}: {
  cifra: CifraDato;
  formato: FormatoCifra;
  grande?: boolean;
  etiqueta?: string;
  aproxHoras?: number;
  comparacion?: Comparacion;
  alinear?: "izquierda" | "derecha";
  ahora?: Date;
}) {
  const sinDato = cifra.valor === null;
  return (
    <span className={cn("inline-flex flex-col gap-0.5", alinear === "derecha" ? "items-end" : "items-start")}>
      <span className="inline-flex items-baseline gap-1">
        {sinDato ? (
          <span title="sin dato" className={cn("text-muted-foreground", grande ? "text-2xl" : "text-sm")}>
            —
          </span>
        ) : (
          <span
            className={cn(
              "font-semibold tabular-nums",
              grande ? "text-2xl" : "text-sm",
              comparacion?.tono === "arriba" && "text-bueno",
              comparacion?.tono === "abajo" && "text-malo",
            )}
          >
            {textoCifra(cifra.valor, formato)}
          </span>
        )}
        {comparacion?.atipico && (
          <span
            className="rounded border border-aviso/50 px-1 text-[10px] leading-4 text-aviso"
            title="Atípico: más del doble o menos de la mitad de la mediana de los últimos 10 de esta red"
          >
            atípico
          </span>
        )}
      </span>
      {!sinDato && cifra.fuente && (
        <ChipFuente
          fuente={cifra.fuente}
          datoActualizadoEn={cifra.datoActualizadoEn}
          etiqueta={etiqueta}
          aproxHoras={aproxHoras}
          ahora={ahora}
        />
      )}
    </span>
  );
}
