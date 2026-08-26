/** Convierte un valor de su rango de datos a una coordenada de pixel. */
export function escalaLineal(
  valor: number,
  dominio: [number, number],
  rango: [number, number],
): number {
  const [d0, d1] = dominio
  const [r0, r1] = rango
  if (d1 === d0) return r0
  return r0 + ((valor - d0) / (d1 - d0)) * (r1 - r0)
}
