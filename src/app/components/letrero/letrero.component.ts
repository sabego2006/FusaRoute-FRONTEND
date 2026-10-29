import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouteSign } from '../../models/route.model';

/** Texto legible para el sentido que documenta un letrero; `null` no se pinta. */
const SENSE_LABEL: Record<NonNullable<RouteSign['sense']>, string> = {
  SUBIENDO: 'Subiendo',
  BAJANDO: 'Bajando',
};

/**
 * Letreros fisicos de una ruta (SCRUM-176): la placa que el pasajero ve en el
 * parabrisas de la buseta, para que pueda reconocerla. El dato viene del trabajo de
 * campo de SCRUM-174/175 — texto y colores reales, no un icono generico.
 *
 * Misma pieza en el detalle de la ruta y en el resultado de busqueda. Si la ruta no
 * tiene ningun letrero con evidencia de campo todavia (el estado real de la mayoria),
 * no pinta nada: ni un hueco ni un letrero inventado.
 */
@Component({
  selector: 'app-letrero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './letrero.component.html',
})
export class LetreroComponent {
  readonly signs = input.required<RouteSign[]>();

  readonly senseLabel = (sense: RouteSign['sense']): string | null => (sense ? SENSE_LABEL[sense] : null);

  /** Clase CSS por plantilla de placa: el nombre del backend ya coincide con el sufijo. */
  readonly plateClass = (template: RouteSign['plates'][number]['template']): string =>
    `letrero-placa letrero-placa--${template.toLowerCase().replace(/_/g, '-')}`;
}
