// Lee el nombre de una carpeta de btw-videos/publicar. Función pura.
// Con fecha: "2026-10-29_jue_04C-G1_cuanto-te-quedo_cuerpo-C" → fecha, día, id y slug.
// Sin fecha (la carpeta _reserva): "04C-G6_stop-motion_cuerpo-C" → fecha y día en null.

export interface NombreCarpeta {
  fecha: string | null;
  dia: string | null;
  id: string;
  slug: string;
}

const CON_FECHA = /^(\d{4}-\d{2}-\d{2})_([a-z]{3})_([^_]+)_(.+)$/;
const SIN_FECHA = /^([^_]+)_(.+)$/;
const EMPIEZA_CON_FECHA = /^\d{4}-\d{2}-\d{2}/;

export function leerNombreCarpeta(nombre: string): NombreCarpeta | null {
  const conFecha = CON_FECHA.exec(nombre);
  if (conFecha) {
    const [, fecha, dia, id, slug] = conFecha;
    if (fecha === undefined || dia === undefined || id === undefined || slug === undefined) return null;
    return { fecha, dia, id, slug };
  }

  // Un nombre que empieza con fecha pero no encaja en la forma completa es inválido, no un id sin fecha.
  if (EMPIEZA_CON_FECHA.test(nombre)) return null;

  const sinFecha = SIN_FECHA.exec(nombre);
  if (sinFecha) {
    const [, id, slug] = sinFecha;
    if (id === undefined || slug === undefined) return null;
    return { fecha: null, dia: null, id, slug };
  }

  return null;
}
