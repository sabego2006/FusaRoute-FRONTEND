/**
 * `true` en dispositivos con puntero táctil (celulares y tablets). Ahí el QR no sirve porque el
 * usuario escanea desde la misma pantalla, así que se prioriza el deep link a la app autenticadora.
 */
export function isMobileDevice(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
