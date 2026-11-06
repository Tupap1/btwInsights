import type { Metadata } from "next";
import { AccesoLlave } from "@/componentes/acceso-llave";
import { validarInvitacion } from "@/servidor/acceso/invitaciones";
import { bd } from "@/servidor/db/cliente";

export const metadata: Metadata = { title: "Registrar llave · BTW Insights" };
export const dynamic = "force-dynamic";

async function nombreDeLaInvitacion(t: string | undefined): Promise<string | null> {
  if (!t) return null;
  try {
    return (await validarInvitacion(bd(), t))?.nombre ?? null;
  } catch {
    return null;
  }
}

export default async function Registrar({ searchParams }: Readonly<{ searchParams: Promise<{ t?: string | string[] }> }>) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : undefined;
  const nombre = await nombreDeLaInvitacion(token);
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-xl font-semibold">BTW Insights</h1>
      {nombre && token ? (
        <>
          <p className="text-sm text-muted-foreground">
            Hola, {nombre}. Crea la llave de acceso de este dispositivo para entrar sin contraseña.
          </p>
          <AccesoLlave modo="registrar" token={token} />
        </>
      ) : (
        <p role="alert" className="text-sm">
          La invitación no sirve o ya se usó.
        </p>
      )}
    </main>
  );
}
