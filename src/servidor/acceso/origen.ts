// Revisión de la cabecera Origin en las rutas de acceso (POST): en producción tiene que ser WEBAUTHN_ORIGEN.
export function origenPermitido(o: { produccion: boolean; esperado: string | undefined; recibido: string | null }): boolean {
  if (!o.produccion) return true;
  return !!o.esperado && o.recibido === o.esperado;
}
