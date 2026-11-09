import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../core/google-maps-loader.service';
import { GeoJsonLineString } from '../../models/route.model';
import { LatLngPoint } from '../map-view/map-view.component';

/** Un punto rotulado en el mapa. `label` es la letra corta que va dentro del marcador. */
export interface MapMarkerPoint {
  position: LatLngPoint;
  title: string;
  label: string;
}

/** Fusagasugá, aproximadamente el centro del área de servicio. */
export const FUSA_CENTER: LatLngPoint = { lat: 4.3364, lng: -74.3638 };

/**
 * Mapa con varios marcadores y, si lo hay, el trazado de la ruta. Encuadra solo: con un
 * punto lo centra; con varios, ajusta el zoom para que todos quepan.
 *
 * Sirve para la vista previa del buscador (origen y destino antes de buscar) y para el
 * resultado (origen, abordaje, bajada, destino y trazado). Sin clave de Google, o si
 * la carga falla, muestra el mismo aviso que el resto de mapas y la pantalla sigue.
 */
@Component({
  selector: 'app-places-map',
  standalone: true,
  imports: [GoogleMap, MapMarker],
  template: `
    @if (notConfigured() || loadError()) {
      <p class="fr-texto-sm aviso" role="status" data-testid="mapa-no-disponible">
        El mapa no está disponible ahora. {{ fallbackText() }}
      </p>
    } @else if (!mapsReady()) {
      <p role="status" class="fr-solo-lectores">Cargando mapa...</p>
      <div class="fr-esqueleto hueco" [style.height.px]="height()" aria-hidden="true"></div>
    } @else {
      <google-map
        [height]="height() + 'px'"
        width="100%"
        [center]="center()"
        [zoom]="15"
        [options]="mapOptions"
        (mapInitialized)="onMapInitialized($event)"
      >
        @for (m of markers(); track m.title) {
          <map-marker [position]="m.position" [title]="m.title" [label]="m.label" />
        }
      </google-map>
    }
    @if (markers().length > 0) {
      <ul class="leyenda fr-texto-sm" [attr.aria-label]="'Puntos en el mapa'">
        @for (m of markers(); track m.title) {
          <li><span class="leyenda__marca" aria-hidden="true">{{ m.label }}</span> {{ m.title }}</li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: block; position: relative; overflow: hidden; max-width: 100%; border-radius: var(--radius-md); }
    .hueco { width: 100%; border-radius: var(--radius-md); }
    .aviso { margin: 0; padding: var(--space-3); border: var(--trazo-2) dashed var(--borde); border-radius: var(--radius-md); }
    .leyenda { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); list-style: none; padding: 0; margin: var(--space-2) 0 0; }
    .leyenda li { display: flex; align-items: center; gap: var(--space-2); min-width: 0; overflow-wrap: anywhere; }
    .leyenda__marca {
      flex: none; display: inline-grid; place-items: center; width: 22px; height: 22px;
      border-radius: var(--radius-full); background: var(--rojo, #d33); color: #fff; font-weight: 700; font-size: 12px;
    }
  `],
})
export class PlacesMapComponent implements OnInit, OnDestroy {
  readonly markers = input<MapMarkerPoint[]>([]);
  readonly path = input<GeoJsonLineString | null>(null);
  readonly height = input(260);
  readonly fallbackText = input('El resto de la información sigue disponible.');
  readonly accentColorToken = input('--muni-fusagasuga');

  private readonly loader = inject(GoogleMapsLoaderService);
  protected readonly notConfigured = computed(() => this.loader.status() === 'sin-clave');
  protected readonly loadError = computed(() => this.loader.status() === 'error');
  protected readonly mapsReady = computed(() => this.loader.status() === 'listo');
  protected readonly mapOptions: google.maps.MapOptions = { disableDefaultUI: true, clickableIcons: false, gestureHandling: 'cooperative' };

  readonly center = computed(() => this.markers()[0]?.position ?? FUSA_CENTER);
  private readonly map = signal<google.maps.Map | null>(null);

  constructor() {
    // Reencuadra cada vez que cambian los puntos o el trazado.
    effect(() => {
      const map = this.map();
      const markers = this.markers();
      const path = this.path();
      if (!map) return;
      map.data.forEach((f) => map.data.remove(f));
      if (path) {
        map.data.addGeoJson({ type: 'Feature', properties: {}, geometry: path });
        map.data.setStyle({ strokeColor: this.resolveAccentColor(), strokeWeight: 4 });
      }
      const points = [...markers.map((m) => m.position), ...(path?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng }))];
      if (points.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        points.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, 40);
      } else if (points.length === 1) {
        map.setCenter(points[0]);
        map.setZoom(16);
      }
    });
  }

  ngOnInit(): void {
    this.loader.load().catch(() => undefined);
  }

  onMapInitialized(map: google.maps.Map): void {
    this.map.set(map);
  }

  private resolveAccentColor(): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(this.accentColorToken()).trim();
    return value || '#4F46E5';
  }

  ngOnDestroy(): void {
    const map = this.map();
    map?.data.forEach((f) => map.data.remove(f));
  }
}
