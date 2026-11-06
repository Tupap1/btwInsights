// T24: el tablero es para ver (Andrés, 6-nov). Editar borradores de Zernio (T15) queda apagado: el botón no se muestra
// y la acción no hace nada. Se prende solo con EDITAR_BORRADORES=1 exacto, sin tocar el código.
export function edicionActiva(valor: string | undefined): boolean {
  return valor === "1";
}

export const MENSAJE_EDICION_APAGADA = "La edición de borradores está apagada: el tablero es solo para ver.";
