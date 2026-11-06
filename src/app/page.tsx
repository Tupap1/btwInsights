import { redirect } from "next/navigation";
import { exigirSesion } from "@/servidor/acceso/sesion";

export const dynamic = "force-dynamic";

export default async function Inicio(): Promise<never> {
  await exigirSesion();
  redirect("/hoy");
}
