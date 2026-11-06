// Nombres en español de los canales y resultados de los leads.
import type { Canal, Resultado } from "@/servidor/leads/esquema";

export const NOMBRE_CANAL: Record<Canal, string> = {
  calculadora: "Calculadora",
  comentario: "Comentario",
  dm: "DM",
  whatsapp: "WhatsApp",
};

export const NOMBRE_RESULTADO: Record<Resultado, string> = { prueba: "Prueba", venta: "Venta", nada: "Nada" };
