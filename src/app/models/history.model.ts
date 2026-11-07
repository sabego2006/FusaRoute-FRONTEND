/**
 * Espeja SearchHistoryResponse del backend (GET /api/users/me/history, RF-07).
 *
 * El historial vive en la cuenta y no en el dispositivo: al entrar desde otro teléfono
 * se ven las mismas seis entradas. Por eso no hay nada guardado en `localStorage` aquí.
 */
export interface SearchHistoryEntry {
  id: number;
  /** Barrio de origen tal como se buscó. Es el valor que se repone en el formulario. */
  origin: string;
  destination: string;
  /** Instante de la búsqueda en ISO-8601; ordena el historial de más reciente a más antigua. */
  searchedAt: string;
  /**
   * Si todavía hay una ruta activa que conecte ese origen con ese destino. La decisión
   * la toma el dominio del backend (RF-11); el frontend solo pinta «ruta ya no
   * disponible» cuando llega en falso, y no la deja repetir.
   *
   * Es opcional a propósito, y no requerida: el frontend puede mergearse antes que el
   * backend, y durante esa ventana la respuesta no trae la clave. `?? true` la trata
   * entonces como disponible, que es el estado normal y no bloquea la pantalla.
   */
  routeAvailable?: boolean;
}
