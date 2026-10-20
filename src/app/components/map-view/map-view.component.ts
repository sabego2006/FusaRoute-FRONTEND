import { Component, OnDestroy, inject, input, signal } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../core/google-maps-loader.service';

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface LatLngPoint {
  lat: number;
  lng: number;
}

interface GeoJsonFeature {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: GeoJsonLineString;
}

/**
 * Pinta en el mapa una ruta ya resuelta por el backend: la polilínea (GeoJSON) y los puntos
 * de origen/destino. No calcula nada — ni distancia, ni tiempo, ni la mejor ruta — solo
 * pinta lo que el backend entrega. Se reutiliza en el detalle de ruta (SCRUM-154).
 */
@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [GoogleMap, MapMarker],
  template: `
    @if (loadError()) {
      <p class="fr-alerta" role="alert">No se pudo cargar el mapa. Intenta de nuevo en un momento.</p>
    } @else if (!mapsReady()) {
      <p class="fr-texto-sm" role="status">Cargando mapa...</p>
    } @else {
      <google-map
        height="320px"
        width="100%"
        [center]="origin()"
        [zoom]="14"
        [options]="mapOptions"
        (mapInitialized)="onMapInitialized($event)"
      >
        <map-marker [position]="origin()" title="Origen" />
        <map-marker [position]="destination()" title="Destino" />
      </google-map>
    }
  `
})
export class MapViewComponent implements OnDestroy {
  path = input.required<GeoJsonLineString>();
  origin = input.required<LatLngPoint>();
  destination = input.required<LatLngPoint>();
  /** Nombre del token --muni-* (styles.css) con el que se traza la línea de la ruta. */
  accentColorToken = input<string>('--muni-fusagasuga');

  private readonly loader = inject(GoogleMapsLoaderService);
  protected readonly mapsReady = signal(false);
  protected readonly loadError = signal(false);
  protected readonly mapOptions: google.maps.MapOptions = { disableDefaultUI: true, clickableIcons: false };

  private mapInstance?: google.maps.Map;

  constructor() {
    this.loader.load().then(
      () => this.mapsReady.set(true),
      () => this.loadError.set(true)
    );
  }

  onMapInitialized(map: google.maps.Map): void {
    this.mapInstance = map;
    map.data.addGeoJson(this.buildPathFeature());
    map.data.setStyle({ strokeColor: this.resolveAccentColor(), strokeWeight: 4 });
  }

  /** La feature GeoJSON que se pinta, tal cual llega del backend como LineString. */
  buildPathFeature(): GeoJsonFeature {
    return { type: 'Feature', properties: {}, geometry: this.path() };
  }

  /** Google Maps pinta sobre canvas, no lee custom properties CSS: hay que resolver el token a su hex. */
  resolveAccentColor(): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(this.accentColorToken()).trim();
    return value || '#4F46E5';
  }

  ngOnDestroy(): void {
    this.mapInstance?.data.forEach((feature) => this.mapInstance!.data.remove(feature));
  }
}
