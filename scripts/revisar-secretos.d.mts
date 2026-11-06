// Tipos de scripts/revisar-secretos.mjs para que TypeScript lo importe desde las pruebas.
export function leerValores(textoEnv: string): Record<string, string>;
export function buscarEn(
  dir: string,
  valores: Record<string, string>,
  omitir?: string[],
): { variable: string; archivo: string }[];
