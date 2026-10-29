import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CongestionSector } from '../../models/route.model';
import { formatTime } from '../../lib/format';

/**
 * 'detail': aviso completo con cada sector y su franja horaria (detalle de ruta).
 * 'compact': solo la marca de posibilidad, sin franjas, para no inflar una tarjeta
 * del catálogo que ya lista barrios y tarifa.
 */
export type TrafficBadgeVariant = 'detail' | 'compact';

/**
 * Aviso de posible congestión (RF-09). Siempre en condicional ("puede haber
 * congestión"), nunca como afirmación: el dato es histórico (RF-09), no una
 * medición en vivo. No pinta nada si no hay sectores — esa decisión vive aquí,
 * no en cada pantalla que lo usa, para que ninguna la olvide.
 *
 * `sectors` acepta `undefined` a propósito: el catálogo (`GET /api/routes`) hoy
 * no manda este campo, y el componente tolera un backend viejo sin que quien lo
 * use tenga que escribir `?? []` en cada sitio.
 */
@Component({
  selector: 'app-traffic-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './traffic-badge.component.html',
  styles: [`
    :host { display: block; }
    .fr-aviso-congestion {
      background: var(--amarillo-congestion);
      color: var(--sobre-amarillo);
      border: var(--trazo-2) solid var(--borde);
      border-radius: var(--radius-md);
      padding: var(--space-3) var(--space-4);
      font: 500 14px/20px var(--font-sans);
      margin: 0 0 var(--space-6);
    }
    .fr-aviso-congestion--compacto {
      border-radius: var(--radius-full);
      box-shadow: var(--sombra-dura-sm);
      font: 600 12px/16px var(--font-sans);
      padding: var(--space-2) var(--space-3);
      margin: 0;
    }
  `]
})
export class TrafficBadgeComponent {
  readonly sectors = input<CongestionSector[] | undefined>(undefined);
  readonly variant = input<TrafficBadgeVariant>('detail');

  readonly list = computed(() => this.sectors() ?? []);
  readonly formatTime = formatTime;
}
