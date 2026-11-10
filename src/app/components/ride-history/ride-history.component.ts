import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LetreroComponent } from '../letrero/letrero.component';
import { Ride } from '../../models/ride.model';
import { relativeTime } from '../../lib/relative-time';

/**
 * "Tus últimos viajes": plegado por defecto (un `<details>` nativo, accesible por
 * teclado sin código). Cada viaje muestra el letrero de la ruta, el destino y hace
 * cuánto fue; tocarlo llena el destino.
 */
@Component({
  selector: 'app-ride-history',
  standalone: true,
  imports: [LetreroComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rides().length > 0) {
      <details class="fr-card fr-viajes" data-testid="ultimos-viajes">
        <summary class="fr-viajes__titulo">Tus últimos viajes ({{ rides().length }})</summary>
        <ul class="fr-viajes__lista">
          @for (r of rides(); track r.id) {
            <li>
              <button type="button" class="fr-viajes__item" (click)="choose.emit(r)"
                      [attr.aria-label]="'Ir otra vez a ' + r.destinationLabel + ', en ' + r.routeName + ', ' + when(r)">
                <span class="fr-viajes__letrero">
                  @if (r.signFile) {
                    <app-letrero [signFile]="r.signFile" [routeName]="r.routeName" />
                  } @else {
                    <span class="fr-texto-sm">{{ r.routeName }}</span>
                  }
                </span>
                <span class="fr-viajes__texto">
                  <strong>{{ r.destinationLabel }}</strong>
                  <span class="fr-texto-sm">{{ when(r) }}</span>
                </span>
              </button>
            </li>
          }
        </ul>
      </details>
    }
  `,
  styles: [`
    :host { display: block; margin-bottom: var(--space-6); }
    .fr-viajes { padding: 0; }
    .fr-viajes__titulo {
      cursor: pointer; min-height: 48px; display: flex; align-items: center;
      padding: var(--space-3) var(--space-4); font: 700 16px/1.2 var(--font-display);
    }
    .fr-viajes__titulo:focus-visible { outline: var(--trazo-2) solid var(--foco, var(--tinta)); outline-offset: -2px; }
    .fr-viajes__lista { list-style: none; margin: 0; padding: 0 var(--space-3) var(--space-3); display: grid; gap: var(--space-2); }
    .fr-viajes__item {
      display: grid; grid-template-columns: minmax(0, 132px) minmax(0, 1fr); align-items: center; gap: var(--space-3);
      width: 100%; min-height: 56px; padding: var(--space-2) var(--space-3);
      border: var(--trazo-1, 1px) solid var(--borde); border-radius: var(--radius-md);
      background: var(--superficie); color: var(--tinta); text-align: left; cursor: pointer;
      font: inherit;
    }
    .fr-viajes__item:focus-visible { outline: var(--trazo-2) solid var(--foco, var(--tinta)); outline-offset: 2px; }
    .fr-viajes__letrero { display: block; min-width: 0; }
    .fr-viajes__letrero ::ng-deep img { width: 100%; height: auto; display: block; }
    .fr-viajes__texto { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .fr-viajes__texto > strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (max-width: 400px) { .fr-viajes__item { grid-template-columns: minmax(0, 96px) minmax(0, 1fr); } }
  `],
})
export class RideHistoryComponent {
  readonly rides = input<Ride[]>([]);
  readonly choose = output<Ride>();

  when(r: Ride): string {
    return relativeTime(r.boardedAt);
  }
}
