import { Component, OnDestroy, computed, inject, input } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../core/google-maps-loader.service';
import { GeoJsonLineString } from '../../models/route.model';

/** La forma que espera Google Maps para un punto; no viene del backend. */
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
    @if (notConfigured()) {
      <p class="fr-texto-sm" role="status">
        El mapa no está configurado en este ambiente. El resto de la información de la ruta
        sigue disponible.
      </p>
    } @else if (loadError()) {
      <p class="fr-alerta" role="alert">No se pudo cargar el mapa. Intenta de nuevo en un momento.</p>
    } @else if (!mapsReady()) {
      <!--
        Esqueleto, no el texto "Cargando mapa...". Ocupa exactamente los 320 px
        que va a ocupar el mapa, así que cuando Google termina de cargar nada
        se desplaza. Con el texto de una línea, la página pegaba un salto de
        300 px justo cuando la persona estaba leyendo el resultado.
      -->
      <p role="status" class="fr-solo-lectores">Cargando mapa del recorrido...</p>
      <div class="fr-esqueleto mapa-hueco" aria-hidden="true"></div>
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
  `,
  styles: [`
    /*
     * El recorte del mapa. Google Maps pinta sus teselas en elementos que se
     * salen del contenedor a propósito (es como consigue el desplazamiento
     * continuo), y sin este recorte esos 11 px de sobra llegaban hasta el
     * documento: en celular aparecía una barra de desplazamiento horizontal en
     * cuanto salía un resultado con mapa.
     *
     * Es anterior a las animaciones; se vio al medir el desborde, no al
     * introducirlo.
     */
    :host {
      display: block;
      /*
       * La posición relativa no es decorativa: sin ella el recorte no sirve.
       * (Nada de acentos graves en estos comentarios: están dentro de la
       * plantilla literal de styles y cualquiera cierra la cadena antes de
       * tiempo. El error que sale no lo menciona.)
       * Google Maps coloca sus capas en absoluto, y un elemento absoluto solo
       * lo recorta el ancestro que sea su bloque contenedor. Con el host
       * estático, el bloque contenedor es otro mucho más arriba y las teselas
       * se salían igual aunque acá dijera overflow: hidden.
       */
      position: relative;
      overflow: hidden;
      max-width: 100%;
      border-radius: var(--radius-md);
    }

    .mapa-hueco {
      height: 320px;
      width: 100%;
      border-radius: var(--radius-md);
    }
  `]
})
export class MapViewComponent implements OnDestroy {
  path = input.required<GeoJsonLineString>();
  origin = input.required<LatLngPoint>();
  destination = input.required<LatLngPoint>();
  /** Nombre del token --muni-* (styles.css) con el que se traza la línea de la ruta. */
  accentColorToken = input<string>('--muni-fusagasuga');

  private readonly loader = inject(GoogleMapsLoaderService);
  /**
   * Los tres estados se leen del signal del servicio, no de la promesa de `load()`: Google
   * puede llamar `gm_authFailure` después de que el script ya hizo `onload`, y solo un signal
   * vivo refleja ese cambio tardío. La promesa solo dispara la carga.
   */
  protected readonly notConfigured = computed(() => this.loader.status() === 'sin-clave');
  protected readonly loadError = computed(() => this.loader.status() === 'error');
  protected readonly mapsReady = computed(() => this.loader.status() === 'listo');
  protected readonly mapOptions: google.maps.MapOptions = { disableDefaultUI: true, clickableIcons: false };

  private mapInstance?: google.maps.Map;

  constructor() {
    this.loader.load().catch(() => undefined);
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
