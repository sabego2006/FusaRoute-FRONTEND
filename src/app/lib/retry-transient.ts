import { HttpErrorResponse } from '@angular/common/http';
import { MonoTypeOperatorFunction, retry, timer } from 'rxjs';

/** Espera base del primer reintento; el segundo espera el doble, el tercero el cuádruple. */
export const RETRY_BASE_MS = 600;

/**
 * Reintentos con espera creciente para peticiones de **solo lectura**.
 *
 * Por qué existe: con señal débil una petición no se pone lenta, se *corta* — el navegador
 * entrega `status 0` (`ERR_NETWORK_CHANGED`, `ERR_CONNECTION_RESET`) y hasta T15 un solo corte
 * dejaba la pantalla en un mensaje de error del que no se salía sin recargar. Un corte así es
 * transitorio por definición: la celda vuelve en un segundo o dos.
 *
 * Solo para GET idempotentes. Nunca envolver una escritura: reintentar un POST que sí llegó
 * duplica el efecto.
 */
export function retryTransient<T>(intentos = 2, baseMs = RETRY_BASE_MS): MonoTypeOperatorFunction<T> {
  return retry<T>({
    count: intentos,
    delay: (error: unknown, intento: number) => {
      if (!isTransient(error)) {
        throw error;
      }
      return timer(baseMs * 2 ** (intento - 1));
    },
  });
}

/**
 * Un fallo que vale la pena reintentar.
 *
 * - `0`: la petición no salió o se cortó a mitad de camino (red que se cae y vuelve).
 * - `408`, `429`, `5xx`: el servidor mismo dice "vuelva a intentar". Incluye el 502/503 del
 *   borde de Render mientras el contenedor del tier gratis despierta.
 *
 * Un `400`, `401`, `403` o `404` **no** se reintenta: el resultado sería idéntico y se
 * gastarían datos justo cuando escasean.
 */
export function isTransient(error: unknown): boolean {
  const status = error instanceof HttpErrorResponse ? error.status : (error as { status?: unknown })?.status;
  if (typeof status !== 'number') {
    return false;
  }
  return status === 0 || status === 408 || status === 429 || (status >= 500 && status <= 599);
}
