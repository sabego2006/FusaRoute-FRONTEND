import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouteSearchResult } from '../../models/route.model';
import { buildTripPlan } from '../../lib/trip-steps';

/**
 * "Su viaje": los tres momentos del trayecto de quien buscó (SCRUM-198).
 *
 * Reemplaza en el resultado de la búsqueda a los dos módulos que había antes — "Por dónde pasa"
 * (la secuencia de la ruta COMPLETA) y "Cómo la toma" (las dos caminatas sueltas). El problema
 * que resuelve, reportado en la prueba en teléfono del 17-nov: si la ruta pasa por A, B, C, D y
 * E y la persona sube en C, leer A y B la hace creer que también recorre esa parte.
 *
 * Lo que decide este componente son las PALABRAS y qué momentos vale la pena mostrar. Qué
 * barrios quedan en el tramo, dónde se sube, dónde se baja y hacia dónde se camina lo calcula
 * el backend sobre el trazado (`tripSegment`); acá no se proyecta ni se recorta nada.
 *
 * El componente `app-route-steps` sigue existiendo y sigue mostrando el recorrido completo,
 * pero solo en el detalle de la ruta (`/rutas/:id`), que es la pantalla cuyo tema ES la ruta.
 */
@Component({
  selector: 'app-trip-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-plan.component.html',
  styles: [`
    /*
     * Solo acomodo: el número grande, la línea que une los momentos y el aire entre ellos.
     * Colores y tipografía salen de los tokens existentes — el rediseño visual es otra tanda.
     */
    .momentos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-4); }
    .momento { display: grid; grid-template-columns: 44px 1fr; gap: var(--space-4); align-items: start; }
    .momento__marca {
      grid-row: 1 / -1;
      display: grid; place-items: center;
      width: 44px; height: 44px;
      border: var(--trazo-2) solid var(--borde);
      border-radius: var(--radius-full);
      background: var(--lima); color: var(--sobre-lima);
      font: 700 20px/1 var(--font-sans);
    }
    /* El bus se distingue del número de paso: es el momento en el que la persona va sentada. */
    .momento--bus .momento__marca { background: var(--indigo); color: var(--sobre-indigo); }
    .momento__frase { font-size: 18px; line-height: 26px; font-weight: 600; margin: 0; color: var(--tinta); }
    .momento__detalle { margin: var(--space-2) 0 0; }
    .momento__barrios { margin: var(--space-2) 0 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--tinta); }
  `],
})
export class TripPlanComponent {
  readonly result = input.required<RouteSearchResult>();

  /** Los tres momentos; `null` cuando la ruta no tiene trazado y no se sabe dónde subir. */
  readonly plan = computed(() => buildTripPlan(this.result()));

  /** Número del momento del bus: 1 si no hay caminata antes, 2 si la hay. */
  readonly busStepNumber = computed(() => (this.plan()?.walkToBoarding ? 2 : 1));

  /** Número del último momento, que depende de cuántos se mostraron antes. */
  readonly lastStepNumber = computed(() => this.busStepNumber() + 1);
}
