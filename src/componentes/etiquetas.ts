// Nombres en español de los valores guardados en la base.
import type { EstadoPublicacion, Formato, Red, Voz } from "@/servidor/tipos";

export const NOMBRE_RED: Record<Red, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };
export const NOMBRE_RED_CORTO: Record<Red, string> = { tiktok: "TT", instagram: "IG", facebook: "FB" };

export const NOMBRE_FORMATO: Record<Formato, string> = {
  la_cuenta: "La cuenta",
  dialogo: "Diálogo",
  prueba_real: "Prueba real",
  plata_3d: "Plata 3D",
  pantalla_dividida: "Pantalla dividida",
  otro: "Otro",
};

export const NOMBRE_VOZ: Record<Voz, string> = {
  fernando: "Fernando",
  andres: "Andrés",
  andres_voice_changer: "Andrés (cambiador de voz)",
  sin_voz: "Sin voz",
  otra: "Otra",
};

export const NOMBRE_ESTADO: Record<EstadoPublicacion, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Por aprobar",
  programado: "Programado",
  publicando: "Publicando",
  publicado: "Publicado",
  parcial: "Parcial",
  fallido: "Fallido",
  cancelado: "Cancelado",
  borrado: "Borrado",
};

export const NOMBRE_MOMENTO: Record<"48h" | "7d" | "ultima", string> = {
  "48h": "A 48 h",
  "7d": "A 7 días",
  ultima: "Última lectura",
};
