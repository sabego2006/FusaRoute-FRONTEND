import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Ride } from '../../models/ride.model';

/**
 * Atajo encima del campo destino: "Volver a: <destino>". Un toque llena el destino con
 * el del último viaje; el origen no se toca, para salir desde donde sea.
 */
@Component({
  selector: 'app-last-destination-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      Si la ruta del último viaje ya no existe (RF-11) no se ofrece el atajo; el aviso
      "Ruta ya no disponible" vive en la lista de viajes, que sí muestra ese viaje.
    -->
    @if (ride(); as r) {
      @if (r.routeAvailable !== false) {
      <button type="button" class="fr-volver" data-testid="volver-a"
              [attr.aria-label]="'Volver a ' + r.destinationLabel + ': usar como destino'"
              (click)="choose.emit(r)">
        <span aria-hidden="true">↩</span>
        <span>Volver a: <strong>{{ r.destinationLabel }}</strong></span>
      </button>
      }
    }
  `,
  styles: [`
    :host { display: block; margin-bottom: var(--space-3); }
    .fr-volver {
      display: inline-flex; align-items: center; gap: var(--space-2);
      max-width: 100%;
      min-height: 44px;
      padding: var(--space-2) var(--space-4);
      border: var(--trazo-2) solid var(--borde);
      border-radius: var(--radius-full);
      background: var(--indigo-suave, var(--superficie));
      color: var(--tinta);
      font: 500 15px/1.2 var(--font-sans);
      cursor: pointer;
      text-align: left;
    }
    .fr-volver > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fr-volver:focus-visible { outline: var(--trazo-2) solid var(--foco, var(--tinta)); outline-offset: 2px; }
  `],
})
export class LastDestinationChipComponent {
  readonly ride = input<Ride | null>(null);
  readonly choose = output<Ride>();
}
