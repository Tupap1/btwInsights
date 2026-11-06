import type { Metadata } from "next";
import { AccesoLlave } from "@/componentes/acceso-llave";

export const metadata: Metadata = { title: "Entrar · BTW Insights" };

export default function Entrar() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">BTW Insights</h1>
        <p className="text-sm text-muted-foreground">Entra con la llave de acceso de este dispositivo.</p>
      </div>
      <AccesoLlave modo="entrar" />
    </main>
  );
}
