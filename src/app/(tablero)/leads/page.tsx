import { FormularioLead } from "@/componentes/formulario-lead";
import { NOMBRE_CANAL, NOMBRE_RESULTADO } from "@/componentes/etiquetas-leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { cargarLeadsFila, leadsPorCanal, leadsPorSemana } from "@/servidor/consultas/leads";
import { formatoEntero } from "@/servidor/consultas/formato";
import { ahoraServidor, diaBogota } from "@/servidor/consultas/tiempo";
import { bd } from "@/servidor/db/cliente";
import { reel } from "@/servidor/db/esquema";
import { CANALES, type Canal, type Resultado } from "@/servidor/leads/esquema";
import { listarUltimos } from "@/servidor/leads/guardar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads · BTW Insights" };

const SEMANAS = 8;

function nombreCanal(c: string): string {
  return c in NOMBRE_CANAL ? NOMBRE_CANAL[c as Canal] : c;
}
function nombreResultado(r: string | null): string {
  if (r === null) return "—";
  return r in NOMBRE_RESULTADO ? NOMBRE_RESULTADO[r as Resultado] : r;
}
/** "2026-11-02" a "2 nov". */
function diaCorto(dia: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${dia}T00:00:00Z`));
}

export default async function PaginaLeads() {
  await exigirSesion();
  const db = bd();
  const hoy = diaBogota(ahoraServidor());
  const [filas, ultimos, reels] = await Promise.all([
    cargarLeadsFila(db),
    listarUltimos(db, 20),
    db.select({ id: reel.id, gancho: reel.gancho }).from(reel).orderBy(reel.id),
  ]);
  const semanas = leadsPorSemana(filas, hoy, SEMANAS);
  const porCanal = leadsPorCanal(filas);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Registro manual (fuente: manual). Semanas de lunes a domingo, hora de Bogotá.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar un lead</CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioLead hoy={hoy} reels={reels} />
        </CardContent>
      </Card>

      <section aria-labelledby="semanas" className="flex flex-col gap-3">
        <h2 id="semanas" className="text-base font-semibold">
          Por semana y canal
        </h2>
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay leads registrados.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  {CANALES.map((c) => (
                    <TableHead key={c} className="text-right">
                      {NOMBRE_CANAL[c]}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {semanas.map((s) => (
                  <TableRow key={s.semana}>
                    <TableCell className="whitespace-nowrap">desde el {diaCorto(s.semana)}</TableCell>
                    {CANALES.map((c) => (
                      <TableCell key={c} className="text-right tabular-nums">
                        {formatoEntero(s.porCanal[c])}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold tabular-nums">{formatoEntero(s.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">Todo el historial</TableCell>
                  {CANALES.map((c) => (
                    <TableCell key={c} className="text-right tabular-nums">
                      {formatoEntero(porCanal[c])}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold tabular-nums">{formatoEntero(filas.length)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="ultimos" className="flex flex-col gap-3">
        <h2 id="ultimos" className="text-base font-semibold">
          Últimos registrados
        </h2>
        {ultimos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin registros.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ultimos.map((l) => (
              <li key={l.id} className="rounded-lg border px-3 py-2 text-sm">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{diaCorto(l.fecha)}</span>
                  <span>{nombreCanal(l.canal)}</span>
                  {l.reelId && <span className="text-muted-foreground">reel {l.reelId}</span>}
                  <span className="text-muted-foreground">· resultado: {nombreResultado(l.resultado)}</span>
                </p>
                {l.nota && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{l.nota}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
