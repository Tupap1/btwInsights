"use client";
// Gráficas del detalle de un video. Reciben los datos por props; no leen nada por su cuenta.
// Solo se dibujan los puntos que existen (un hueco queda en blanco; no se interpola).
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatoDecimal, formatoEntero } from "@/servidor/consultas/formato";

export interface SerieGrafica {
  clave: string;
  nombre: string;
  /** Color como variable de CSS, p. ej. "var(--chart-1)". */
  color: string;
  /** Punteada (la mediana). */
  punteada?: boolean;
}

type Fila = Record<string, number | null>;

const ESTILO_TOOLTIP = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

export function GraficaCrecimiento({ filas, series }: { filas: Fila[]; series: SerieGrafica[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Vistas contra horas desde la publicación">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={filas} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="horas"
            type="number"
            domain={[0, "dataMax"]}
            tickFormatter={(h: number) => `${formatoEntero(h)} h`}
            stroke="var(--muted-foreground)"
            fontSize={11}
          />
          <YAxis
            tickFormatter={(v: number) => formatoEntero(v)}
            stroke="var(--muted-foreground)"
            fontSize={11}
            width={52}
          />
          <Tooltip
            contentStyle={ESTILO_TOOLTIP}
            labelFormatter={(h) => `${formatoEntero(Number(h))} h desde la publicación`}
            formatter={(v) => (typeof v === "number" ? formatoEntero(v) : "—")}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s) => (
            <Line
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              stroke={s.color}
              strokeWidth={s.punteada ? 1.5 : 2.5}
              strokeDasharray={s.punteada ? "5 4" : undefined}
              dot={s.punteada ? false : { r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficaRetencion({
  filas,
  nombreMejor,
}: {
  filas: { segundo: number; pct: number | null; mejor: number | null }[];
  nombreMejor: string | null;
}) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Retención por segundo">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={filas} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="segundo"
            type="number"
            domain={[0, "dataMax"]}
            tickFormatter={(s: number) => `${formatoEntero(s)} s`}
            stroke="var(--muted-foreground)"
            fontSize={11}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${formatoEntero(v)} %`}
            stroke="var(--muted-foreground)"
            fontSize={11}
            width={48}
          />
          <Tooltip
            contentStyle={ESTILO_TOOLTIP}
            labelFormatter={(s) => `Segundo ${formatoEntero(Number(s))}`}
            formatter={(v) => (typeof v === "number" ? `${formatoDecimal(v)} %` : "—")}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line dataKey="pct" name="Este video" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          {nombreMejor !== null && (
            <Line
              dataKey="mejor"
              name={`Mejor del formato (${nombreMejor})`}
              stroke="var(--chart-3)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
