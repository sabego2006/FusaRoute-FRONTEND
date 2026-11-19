import { Injectable, signal } from '@angular/core';

/**
 * Pantallas que no alcanzaron a cargarse (T15, SCRUM-199).
 *
 * El problema que resuelve, medido con `T15-throttle.mjs` en la condición `red-intermitente`:
 * `/rutas` se carga de forma diferida, y si la red se cae justo mientras baja su chunk, el
 * `import()` falla, el router aborta la navegación y la pantalla **queda en blanco** — ni la
 * lista, ni el esqueleto, ni un mensaje. 75 s después seguía igual.
 *
 * Por qué el arreglo no es "reintentar el import()": una vez que la descarga de un módulo
 * falla, el navegador guarda ese fracaso en su module map y los `import()` siguientes del
 * mismo especificador fallan sin volver a pedir nada. La única salida real es volver a cargar
 * el documento, así que esto solo guarda qué pantalla se cayó para poder decirlo y ofrecerlo.
 */
@Injectable({ providedIn: 'root' })
export class NavigationFailureStore {
  private readonly url = signal<string | null>(null);

  /** URL que el router no pudo abrir, o `null` si todo va bien. */
  readonly failedUrl = this.url.asReadonly();

  fail(url: string): void {
    this.url.set(url);
  }

  clear(): void {
    this.url.set(null);
  }
}
