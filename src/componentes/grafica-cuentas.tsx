"use client";
// Seguidores de una red en el tiempo: una línea por fuente, solo con las lecturas que existen (sin interpolar).
// Cada punto lleva su fuente y su fecha en el tooltip. Cabe a 375 px (altura fija, ancho 100 %).
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatoEntero, formatoFechaCorta, formatoFechaHora } from "@/servidor/consultas/formato";

export interface SerieCuentaGrafica {
  nombre: string;
  /** Color como variable de CSS, p. ej. "var(--chart-1)". */
  color: string;
  /** Marca de tiempo (ms) y seguidores de cada lectura. */
  puntos: { t: number; v: number }[];
}

export function GraficaCuentas({ etiqueta, series }: { etiqueta: string; series: SerieCuentaGrafica[] }) {
  return (
    <div className="h-56 w-full min-w-0" role="img" aria-label={`Seguidores de ${etiqueta} en el tiempo`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => formatoFechaCorta(new Date(t))}
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickCount={4}
          />
          <YAxis
            dataKey="v"
            type="number"
            domain={["auto", "auto"]}
            allowDecimals={false}
            tickFormatter={(v: number) => formatoEntero(v)}
            stroke="var(--muted-foreground)"
            fontSize={11}
            width={46}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(t) => formatoFechaHora(new Date(Number(t)))}
            formatter={(v, nombre) => [typeof v === "number" ? formatoEntero(v) : "—", `Fuente: ${String(nombre)}`]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s) => (
            <Line
              key={s.nombre}
              data={s.puntos}
              dataKey="v"
              name={s.nombre}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
