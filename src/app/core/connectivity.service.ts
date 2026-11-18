import { Injectable, signal } from '@angular/core';
import { EMPTY, Observable, fromEvent, map, of, take } from 'rxjs';

/**
 * Conectividad del navegador, para decidir si la búsqueda de ruta usa el endpoint
 * online (que cronometra contra Google) o el offline (que calcula por distancia
 * sobre el GeoJSON propio).
 *
 * Qué tan confiable es: `navigator.onLine` responde si hay *interfaz de red*, no si
 * hay internet de verdad. Conectado al wifi de un local que no deja salir, dirá que
 * hay conexión. Alcanza para el caso que nos importa — el usuario en la calle que se
 * queda sin datos, donde sí cambia a false — y la alternativa (hacer ping a un
 * endpoint antes de cada búsqueda) gastaría datos justo cuando escasean. Si la
 * llamada online falla igual, el componente reintenta por el endpoint offline.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly online = signal(this.readInitialState());

  /** `false` cuando el navegador reporta que no hay red. */
  readonly isOnline = this.online.asReadonly();

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }

  /**
   * Emite **una vez** cuando vuelve la red, o de inmediato si ya la hay (T15, SCRUM-199).
   *
   * Para qué: con señal débil la petición no se pone lenta, se corta, y el navegador avisa
   * del regreso de la red antes de que el usuario alcance a tocar "Reintentar". Volver a
   * pedir en ese momento convierte un error terminal en una espera de un par de segundos.
   */
  whenOnlineAgain(): Observable<void> {
    if (typeof window === 'undefined' || this.online()) {
      return of(undefined);
    }
    return fromEvent(window, 'online').pipe(take(1), map(() => undefined));
  }

  /** Cada vez que la red regresa, sin importar cuántas veces. */
  reconnections(): Observable<void> {
    if (typeof window === 'undefined') {
      return EMPTY;
    }
    return fromEvent(window, 'online').pipe(map(() => undefined));
  }

  private readInitialState(): boolean {
    // Si no hay navigator (prerender), se asume que hay red: el peor caso es intentar
    // la búsqueda online y caer al reintento offline.
    return typeof navigator === 'undefined' || navigator.onLine;
  }
}
