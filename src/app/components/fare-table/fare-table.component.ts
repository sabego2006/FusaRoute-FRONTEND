import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Fare, RouteType } from '../../models/route.model';
import { formatCop, formatDateEs } from '../../lib/format';

/**
 * Costo del pasaje de una ruta (RF-06): precio único si es urbana, tabla por punto de
 * bajada si es intermunicipal, ordenada de menor a mayor por el backend. Misma pieza
 * en el detalle de la ruta y en el resultado de búsqueda: antes el bloque de tarifa
 * estaba duplicado en ambas plantillas.
 */
@Component({
  selector: 'app-fare-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fare-table.component.html'
})
export class FareTableComponent {
  readonly fares = input.required<Fare[]>();
  readonly type = input.required<RouteType>();

  // Opcional: el resultado de búsqueda la trae, pero una ruta de un backend anterior a
  // SCRUM-17 no la manda. Sin ella, la pantalla simplemente no muestra la línea.
  readonly lastUpdatedAt = input<string | null>(null);

  readonly isUrban = computed(() => this.type() === 'URBANA');

  readonly formatCop = formatCop;
  readonly formatDateEs = formatDateEs;
}
