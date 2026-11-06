import { Cifra } from "@/componentes/cifra";
import { NOMBRE_RED } from "@/componentes/etiquetas";
import { GraficaCuentas, type SerieCuentaGrafica } from "@/componentes/grafica-cuentas";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { exigirSesion } from "@/servidor/acceso/sesion";
import { consultarCuentas } from "@/servidor/consultas/cuentas";
import { REDES } from "@/servidor/consultas/datos";
import { NOMBRE_FUENTE } from "@/servidor/consultas/formato";
import { ahoraServidor } from "@/servidor/consultas/tiempo";
import { bd } from "@/servidor/db/cliente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cuentas · BTW Insights" };

const COLORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export default async function PaginaCuentas() {
  await exigirSesion();
  const ahora = ahoraServidor();
  const { series, ultima } = await consultarCuentas(bd());

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Cuentas</h1>
        <p className="text-sm text-muted-foreground">
          Seguidores por red en cada lectura. Una línea por fuente; solo se dibujan las lecturas que existen.
        </p>
      </header>

      <section aria-labelledby="ultima" className="flex flex-col gap-3">
        <h2 id="ultima" className="text-base font-semibold">
          Última cifra (fuente y antigüedad bajo cada número)
        </h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Red</TableHead>
                <TableHead>Seguidores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REDES.map((red) => (
                <TableRow key={red}>
                  <TableCell className="font-medium">{NOMBRE_RED[red]}</TableCell>
                  <TableCell>
                    <Cifra cifra={ultima[red]} formato="entero" ahora={ahora} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="serie" className="flex flex-col gap-3">
        <h2 id="serie" className="text-base font-semibold">
          Seguidores en el tiempo
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {REDES.map((red) => {
            const grafica: SerieCuentaGrafica[] = series
              .filter((s) => s.red === red)
              .map((s, i) => ({
                nombre: NOMBRE_FUENTE[s.fuente],
                color: COLORES[i % COLORES.length] ?? "var(--chart-1)",
                puntos: s.puntos.map((p) => ({ t: p.leidoEn.getTime(), v: p.seguidores })),
              }));
            return (
              <Card key={red}>
                <CardHeader>
                  <CardTitle className="text-base">{NOMBRE_RED[red]}</CardTitle>
                </CardHeader>
                <CardContent>
                  {grafica.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no hay lecturas de seguidores (sin dato).</p>
                  ) : (
                    <GraficaCuentas etiqueta={NOMBRE_RED[red]} series={grafica} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
