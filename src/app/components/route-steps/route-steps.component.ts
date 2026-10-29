import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { pickNeighborhoodSteps } from '../../lib/route-steps';

/**
 * Barrios de una ruta como secuencia numerada de pasos (RF-05). Misma pieza en el
 * detalle de la ruta y en el resultado de búsqueda: antes el `<ol>` estaba duplicado
 * en ambas plantillas. El recorte a 7 es solo presentación (ver `pickNeighborhoodSteps`);
 * el backend entrega la lista completa y en orden de recorrido.
 */
@Component({
  selector: 'app-route-steps',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-steps.component.html'
})
export class RouteStepsComponent {
  readonly neighborhoods = input.required<string[]>();

  readonly steps = computed(() => pickNeighborhoodSteps(this.neighborhoods()));
}
