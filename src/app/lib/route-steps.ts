export const MAX_STEPS = 7;

/**
 * Barrios que se muestran como secuencia de pasos (RF-05): todos si son 7 o menos; si son
 * más, 7 repartidos de forma uniforme incluyendo siempre el primero y el último. Es solo
 * presentación: el backend entrega la lista completa y en orden de recorrido.
 */
export function pickNeighborhoodSteps(neighborhoods: string[], max: number = MAX_STEPS): string[] {
  const total = neighborhoods.length;
  if (total <= max) {
    return neighborhoods;
  }
  // Con total > max el paso entre índices es mayor que 1, así que el redondeo nunca repite índice.
  return Array.from({ length: max }, (_, i) => neighborhoods[Math.round((i * (total - 1)) / (max - 1))]);
}
