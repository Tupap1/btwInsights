// Las pantallas del tablero. Las principales van siempre en la barra; las demás, en "Más" hasta pantallas anchas.
import { BarChart3, CalendarDays, Film, Home, Inbox, Lightbulb, Megaphone, Users, type LucideIcon } from "lucide-react";

export interface Enlace {
  href: string;
  texto: string;
  icono: LucideIcon;
  /** Breve, para la página "Más". */
  descripcion: string;
}

export const ENLACES_PRINCIPALES: readonly Enlace[] = [
  { href: "/hoy", texto: "Hoy", icono: Home, descripcion: "La semana, lo que sale hoy y las alertas." },
  { href: "/videos", texto: "Videos", icono: Film, descripcion: "Cada reel por red." },
  { href: "/cola", texto: "Cola", icono: CalendarDays, descripcion: "Los próximos 14 días y los borradores." },
];

export const ENLACES_SECUNDARIOS: readonly Enlace[] = [
  { href: "/sin-asignar", texto: "Sin asignar", icono: Inbox, descripcion: "Publicaciones que no se pudieron unir a un reel." },
  { href: "/ideas", texto: "Ideas", icono: Lightbulb, descripcion: "El banco de ideas y \"Pasar a reel\"." },
  { href: "/leads", texto: "Leads", icono: Megaphone, descripcion: "Registro manual de leads por canal." },
  { href: "/cuentas", texto: "Cuentas", icono: Users, descripcion: "Seguidores por red en el tiempo." },
  { href: "/aprendizajes", texto: "Aprendizajes", icono: BarChart3, descripcion: "Qué gancho, formato y voz funcionan." },
];
