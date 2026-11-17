import { Component, computed, input, model, output } from '@angular/core';
import { Place, TripEnd } from '../../models/place.model';
import { endState, pointLabel } from '../../lib/trip-end';
import { PlaceComboboxComponent } from '../place-combobox/place-combobox.component';

/**
 * Una punta del viaje, con sus tres maneras de indicarla a la vista (SCRUM-195):
 * escribir el lugar, "Usar mi ubicación" (solo el origen) y "Señalar en el mapa".
 * Cuando la punta es un punto (mapa o GPS) el campo se cambia por una ficha legible
 * ("Punto en el mapa") con "Cambiar" y "Quitar": nunca se muestran coordenadas.
 *
 * Es un `<fieldset>` con su `<legend>`: el lector de pantalla anuncia la pregunta al entrar.
 * La pantalla decide qué hacen los botones (pedir el GPS, abrir el mapa); aquí solo se avisa.
 */
@Component({
  selector: 'app-trip-end-field',
  standalone: true,
  imports: [PlaceComboboxComponent],
  template: `
    <fieldset class="extremo">
      <legend class="extremo__pregunta">{{ question() }}</legend>
      @if (state() === 'point') {
        <div class="extremo__ficha" role="group" [attr.aria-label]="question() + ' ' + pointText()">
          <svg class="extremo__pin" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
            <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" fill="currentColor"/>
          </svg>
          <span class="extremo__ficha-texto">{{ pointText() }}</span>
          <button type="button" class="fr-btn extremo__ficha-btn" (click)="change()">Cambiar</button>
          <button type="button" class="fr-btn extremo__ficha-btn" (click)="value.set(null)">Quitar</button>
        </div>
        <p role="status" class="fr-solo-lectores">{{ pointText() }} elegido.</p>
      } @else {
        <div class="extremo__fila">
          <app-place-combobox
            [label]="fieldName()"
            [labelVisible]="false"
            [placeholder]="placeholder()"
            [places]="places()"
            [showActions]="false"
            [hint]="hint()"
            [(value)]="value" />
          <ng-content select="[slot=accion]" />
        </div>
        <div class="extremo__atajos">
          @if (offerMyLocation()) {
            <button type="button" class="fr-btn extremo__atajo" [disabled]="locating()" (click)="useMyLocation.emit()">
              <svg class="extremo__icono" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.9 3A9 9 0 0 0 13 3.1V1h-2v2.1A9 9 0 0 0 3.1 11H1v2h2.1A9 9 0 0 0 11 20.9V23h2v-2.1a9 9 0 0 0 7.9-7.9H23v-2h-2.1zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" fill="currentColor"/>
              </svg>
              Usar mi ubicación
            </button>
          }
          <button type="button" class="fr-btn extremo__atajo" (click)="pickOnMap.emit()">
            <svg class="extremo__icono" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" fill="currentColor"/>
            </svg>
            Señalar en el mapa
          </button>
        </div>
      }
    </fieldset>
  `,
  styles: [`
    :host { display: block; }
    .extremo { border: 0; margin: 0; padding: 0; min-width: 0; }
    .extremo__pregunta { font: 700 20px/26px var(--font-display); color: var(--tinta); padding: 0; margin-bottom: var(--space-2); }
    .extremo__fila { display: flex; align-items: flex-end; gap: var(--space-2); }
    .extremo__fila > app-place-combobox { flex: 1 1 auto; min-width: 0; }
    .extremo__atajos { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
    .extremo__atajo { flex: 1 1 160px; min-height: 48px; gap: var(--space-2); justify-content: center; align-items: center; box-sizing: border-box; }
    .extremo__icono, .extremo__pin { flex: 0 0 auto; }
    .extremo__ficha {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2);
      border: var(--trazo-2) solid var(--borde); border-radius: var(--radius-md);
      background: var(--indigo-suave); color: var(--tinta); padding: var(--space-2) var(--space-3);
    }
    .extremo__ficha-texto { flex: 1 1 auto; font-weight: 700; min-width: 0; }
    .extremo__ficha-btn { min-height: 44px; min-width: 44px; box-sizing: border-box; }
  `],
})
export class TripEndFieldComponent {
  readonly end = input.required<'origin' | 'destination'>();
  readonly places = input<Place[]>([]);
  readonly offerMyLocation = input(false);
  readonly locating = input(false);
  readonly hint = input<string | null>(null);
  /** Lo elegido en esta punta; `null` mientras no haya nada elegido. */
  readonly value = model<TripEnd | null>(null);

  readonly pickOnMap = output<void>();
  readonly useMyLocation = output<void>();

  readonly state = computed(() => endState(this.value()));
  readonly pointText = computed(() => pointLabel(this.value()) ?? '');
  readonly question = computed(() => (this.end() === 'origin' ? '¿Desde dónde sale?' : '¿A dónde va?'));
  /** Nombre accesible del campo de texto (el que ya usaban las pruebas): "Origen" / "Destino". */
  readonly fieldName = computed(() => (this.end() === 'origin' ? 'Origen' : 'Destino'));
  readonly placeholder = computed(() =>
    this.end() === 'origin'
      ? 'Escriba un lugar, ej.: Indio'
      : 'Escriba un lugar, ej.: Terminal');

  /** "Cambiar": un punto del mapa se vuelve a señalar; el del GPS se cambia escribiendo. */
  change(): void {
    if (this.value()?.kind === 'map') this.pickOnMap.emit();
    else this.value.set(null);
  }
}
