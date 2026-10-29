import { Component, computed, inject, output, signal } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../core/google-maps-loader.service';
import { LatLngPoint } from '../map-view/map-view.component';

/** Qué punta del viaje se está editando con el próximo clic sobre el mapa. */
export type PickerMode = 'origin' | 'destination';

/** Un punto fijado por el usuario, por punta. `null` significa "sin fijar". */
export interface PickedPoints {
  origin: LatLngPoint | null;
  destination: LatLngPoint | null;
}

/**
 * Selector opcional de origen/destino en el mapa (SCRUM-130, incremento). Los barrios
 * siguen siendo obligatorios y los eligen los selectores de la pantalla; esto solo
 * afina la última milla cuando la ruta tiene trazado cargado. Un clic sobre el mapa
 * emite el punto por `pointsChange`; "Quitar" lo deja en `null`.
 *
 * Sin clave de Google Maps, o si el script falla, se muestra un aviso: la búsqueda
 * por barrio sigue funcionando, así que no se bloquea el formulario.
 *
 * Centrado en Fusagasugá: el servicio es local y abrir el mapa en otro punto obligaría
 * al usuario a desplazarse antes de poder hacer su primer clic.
 */
@Component({
  selector: 'app-map-point-picker',
  standalone: true,
  imports: [GoogleMap, MapMarker],
  template: `
    @if (notConfigured() || loadError()) {
      <p class="fr-texto-sm" role="status">
        Elegir en el mapa no está disponible ahora. La búsqueda por barrio funciona igual.
      </p>
    } @else if (!mapsReady()) {
      <p class="fr-texto-sm" role="status">Cargando mapa...</p>
    } @else {
      <div class="fr-pila" style="gap: var(--space-3);">
        <fieldset class="fr-fila" style="gap: var(--space-4); border: 0; padding: 0;">
          <legend class="fr-etiqueta" style="margin-bottom: var(--space-2);">
            Al tocar el mapa, el punto se fija como:
          </legend>
          <label class="fr-fila" style="gap: var(--space-2);">
            <input type="radio" name="picker-mode" value="origin"
                   [checked]="mode() === 'origin'" (change)="mode.set('origin')" />
            <span>Origen</span>
          </label>
          <label class="fr-fila" style="gap: var(--space-2);">
            <input type="radio" name="picker-mode" value="destination"
                   [checked]="mode() === 'destination'" (change)="mode.set('destination')" />
            <span>Destino</span>
          </label>
        </fieldset>

        <google-map
          height="280px"
          width="100%"
          [center]="center"
          [zoom]="13"
          [options]="mapOptions"
          (mapClick)="onMapClick($event)"
        >
          @if (points().origin; as o) {
            <map-marker [position]="o" title="Origen elegido" />
          }
          @if (points().destination; as d) {
            <map-marker [position]="d" title="Destino elegido" />
          }
        </google-map>

        <div class="fr-fila" style="gap: var(--space-3); flex-wrap: wrap;">
          @if (points().origin) {
            <button type="button" class="fr-btn" (click)="clear('origin')">Quitar origen</button>
          }
          @if (points().destination) {
            <button type="button" class="fr-btn" (click)="clear('destination')">Quitar destino</button>
          }
        </div>
      </div>
    }
  `,
})
export class MapPointPickerComponent {
  /** Se emite en cada cambio para que el formulario padre lea la última versión. */
  readonly pointsChange = output<PickedPoints>();

  readonly points = signal<PickedPoints>({ origin: null, destination: null });
  readonly mode = signal<PickerMode>('origin');

  private readonly loader = inject(GoogleMapsLoaderService);
  // Se leen del signal del servicio por la misma razón que en MapViewComponent: Google
  // puede llamar gm_authFailure DESPUÉS de que el script hizo onload, y la promesa de
  // load() no refleja ese cambio tardío.
  protected readonly notConfigured = computed(() => this.loader.status() === 'sin-clave');
  protected readonly loadError = computed(() => this.loader.status() === 'error');
  protected readonly mapsReady = computed(() => this.loader.status() === 'listo');

  /** Fusagasugá, aproximadamente el centro geográfico del área de servicio. */
  protected readonly center: LatLngPoint = { lat: 4.3364, lng: -74.3638 };
  protected readonly mapOptions: google.maps.MapOptions = { disableDefaultUI: true, clickableIcons: false };

  constructor() {
    this.loader.load().catch(() => undefined);
  }

  onMapClick(event: google.maps.MapMouseEvent): void {
    const latLng = event.latLng;
    if (!latLng) return;
    const picked: LatLngPoint = { lat: latLng.lat(), lng: latLng.lng() };
    this.update(this.mode(), picked);
    // Al fijar un punto, el próximo clic edita la otra punta: ahorra un paso en el
    // caso común "fijo el origen y después el destino".
    this.mode.set(this.mode() === 'origin' ? 'destination' : 'origin');
  }

  clear(which: PickerMode): void {
    this.update(which, null);
  }

  private update(which: PickerMode, value: LatLngPoint | null): void {
    const next = { ...this.points(), [which]: value };
    this.points.set(next);
    this.pointsChange.emit(next);
  }
}
