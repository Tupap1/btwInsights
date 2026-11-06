import { ActualizarAlEntrar } from "@/componentes/actualizar-al-entrar";
import { Navegacion } from "@/componentes/navegacion";
import { exigirSesion } from "@/servidor/acceso/sesion";

// Todo el tablero lee la base y exige sesión en cada petición: nada se genera de antemano.
export const dynamic = "force-dynamic";

export default async function LayoutTablero({ children }: Readonly<{ children: React.ReactNode }>) {
  await exigirSesion();
  return (
    <>
      <Navegacion />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 md:pb-8">
        {/* T25: cada vez que se entra, una lectura nueva (solo GET) y la página se vuelve a pintar. */}
        <ActualizarAlEntrar />
        {children}
      </main>
    </>
  );
}
