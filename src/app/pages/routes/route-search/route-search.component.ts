import { Component, ElementRef, Injector, OnDestroy, OnInit, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { RouteService } from '../../../services/route.service';
import { PlaceService } from '../../../services/place.service';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { RouteNotFoundProblem, RouteSearchParams, RouteSearchResult } from '../../../models/route.model';
import { Place, TripEnd } from '../../../models/place.model';
import { FavoriteDestination } from '../../../models/favorite.model';
import { findExactPlace } from '../../../lib/place-search';
import { buildSearchParams } from '../../../lib/trip-params';
import { RouteStepsComponent } from '../../../components/route-steps/route-steps.component';
import { FareTableComponent } from '../../../components/fare-table/fare-table.component';
import { LetreroComponent } from '../../../components/letrero/letrero.component';
import { TrafficBadgeComponent } from '../../../components/traffic-badge/traffic-badge.component';
import { ComboboxAction, PlaceComboboxComponent } from '../../../components/place-combobox/place-combobox.component';
import { MapMarkerPoint, PlacesMapComponent } from '../../../components/places-map/places-map.component';
import { MapPickDialogComponent } from '../../../components/map-pick-dialog/map-pick-dialog.component';
import { LatLngPoint } from '../../../components/map-view/map-view.component';

type End = 'origin' | 'destination';

/** Tiempo máximo para que el GPS conteste antes de dejar al usuario escribir. */
export const GPS_TIMEOUT_MS = 8_000;

/**
 * Buscador de ruta (RF-04, SCRUM-54, SCRUM-130) y su resultado, en la misma pantalla.
 *
 * Cada punta es un campo escribible sobre los lugares canónicos de `GET /api/places`,
 * con dos atajos: "Mi ubicación" (solo el origen, por GPS) y "Elegir en el mapa".
 * Sigue cabiendo en 4 acciones (RNF-04): abrir, origen, destino, ¡Hágale!.
 *
 * La plantilla reserva dos huecos para lo que viene en esta misma pantalla ("Ya me
 * subí", atajo del último destino, historial): uno encima del campo destino y otro
 * debajo del resultado. Entrar ahí no exige tocar la lógica de búsqueda.
 */
@Component({
  selector: 'app-route-search',
  standalone: true,
  imports: [RouterLink, RouteStepsComponent, FareTableComponent, LetreroComponent, TrafficBadgeComponent,
            PlaceComboboxComponent, PlacesMapComponent, MapPickDialogComponent],
  templateUrl: './route-search.component.html',
  styles: [`
    .fr-campo-con-accion { display: flex; align-items: flex-end; gap: var(--space-2); }
    .fr-campo-con-accion > app-place-combobox { flex: 1 1 auto; min-width: 0; }

    .fr-boton-favorito {
      flex: 0 0 auto;
      background: transparent;
      border: var(--trazo-2) solid var(--borde);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      min-width: 48px;
      min-height: 48px;
      color: var(--tinta);
    }
    .fr-boton-favorito--activo { color: var(--amarillo-congestion, #d99a00); }
    .fr-boton-favorito:disabled { opacity: .45; cursor: not-allowed; }
    /* Los keyframes fr-pop y fr-anillo viven en el CSS global (encapsulacion). Nada de acentos graves aqui. */
    .fr-boton-favorito { position: relative; }
    .fr-boton-favorito > span { display: block; }
    .fr-boton-favorito--pulsado > span { animation: fr-pop var(--vel-media) var(--curva-resorte) both; }
    .fr-boton-favorito--pulsado::before {
      content: "";
      position: absolute;
      inset: -2px;
      border: var(--trazo-2) solid currentColor;
      border-radius: var(--radius-md);
      animation: fr-anillo var(--vel-lenta) var(--curva-salida) both;
      pointer-events: none;
    }
    .fr-boton-favorito:focus-visible { outline: var(--trazo-2) solid var(--tinta); outline-offset: 2px; }
    .fr-nota-favorito { margin: var(--space-2) 0 0; }

    /* Cifra tabular: el numero se cuenta hacia arriba y no debe sacudirse de lado. */
    .fr-eta-numero {
      font: 700 32px/36px var(--font-display);
      color: var(--indigo-accion);
      font-variant-numeric: tabular-nums;
    }
    .fr-eta-fuente { display: block; margin-top: var(--space-1); }
    .fr-aviso-caminata {
      border: var(--trazo-2) solid var(--borde);
      border-radius: var(--radius-md);
      background: var(--amarillo-congestion);
      color: var(--sobre-amarillo);
      padding: var(--space-3) var(--space-4);
      margin: 0 0 var(--space-3);
    }
    .fr-vista-previa { margin-top: var(--space-4); }
    .fr-cercanas { margin: var(--space-2) 0 0; padding-left: var(--space-5); }
  `],
})
export class RouteSearchComponent implements OnInit, OnDestroy {
  private readonly routeService = inject(RouteService);
  private readonly placeService = inject(PlaceService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly userService = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  readonly places = signal<Place[]>([]);
  readonly placesError = signal(false);

  readonly origin = signal<TripEnd | null>(null);
  readonly destination = signal<TripEnd | null>(null);
  readonly originHint = signal<string | null>(null);
  readonly locating = signal(false);

  readonly loading = signal(false);
  readonly result = signal<RouteSearchResult | null>(null);
  readonly notFound = signal<{ detail: string; nearest: string[] } | null>(null);
  readonly errorMessage = signal<string | null>(null);
  /** Si el resultado salió del endpoint offline (sin red no hay tiempo). */
  readonly servedOffline = signal(false);

  /** Valor animado del tiempo; `result()` guarda siempre el verdadero. */
  readonly etaMostrado = signal(0);
  readonly favoritoPulsado = signal(false);

  private readonly zonaResultado = viewChild.required<ElementRef<HTMLElement>>('zonaResultado');
  private readonly pickDialog = viewChild.required(MapPickDialogComponent);
  private cuadroEta = 0;
  private relojPulso: ReturnType<typeof setTimeout> | null = null;

  readonly isOnline = this.connectivity.isOnline;
  readonly isUrban = computed(() => this.result()?.route.type === 'URBANA');
  readonly canSearch = computed(() => !!this.origin() && !!this.destination() && !this.loading());

  readonly travelDistanceLabel = computed(() => {
    const meters = this.result()?.travelDistanceInMeters;
    if (meters == null) return null;
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
  });

  /** Rótulo de dónde sale el tiempo. Sin `etaSource` (backend viejo) se dice "aprox.". */
  readonly etaSourceLabel = computed(() => {
    switch (this.result()?.etaSource) {
      case 'TRAFFIC': return 'con el tráfico de ahora';
      case 'ESTIMATED': return 'estimado';
      default: return 'aprox.';
    }
  });

  /** Vista previa antes de buscar: un marcador por punta ya elegida. */
  readonly previewMarkers = computed<MapMarkerPoint[]>(() => {
    const out: MapMarkerPoint[] = [];
    const o = this.origin();
    const d = this.destination();
    const op = endPoint(o);
    const dp = endPoint(d);
    if (o && op) out.push({ position: op, title: `Origen: ${o.label}`, label: 'A' });
    if (d && dp) out.push({ position: dp, title: `Destino: ${d.label}`, label: 'B' });
    return out;
  });

  /** Marcadores del resultado: origen, abordaje, bajada y destino, en ese orden. */
  readonly resultMarkers = computed<MapMarkerPoint[]>(() => {
    const r = this.result();
    if (!r) return [];
    const out: MapMarkerPoint[] = [];
    const o = r.origin ?? toResolved(this.origin());
    const d = r.destination ?? toResolved(this.destination());
    if (o) out.push({ position: { lat: o.lat, lng: o.lng }, title: `Sale de ${o.label}`, label: 'A' });
    if (r.boarding) out.push({ position: { lat: r.boarding.latitude, lng: r.boarding.longitude }, title: 'Aquí toma la buseta', label: '↑' });
    if (r.dropOff) out.push({ position: { lat: r.dropOff.latitude, lng: r.dropOff.longitude }, title: 'Aquí se baja', label: '↓' });
    if (d) out.push({ position: { lat: d.lat, lng: d.lng }, title: `Llega a ${d.label}`, label: 'B' });
    return out;
  });

  // ---- Favorito (RF-10) ----
  readonly favorite = signal<FavoriteDestination | null>(null);
  readonly savingFavorite = signal(false);
  readonly canUseFavorite = computed(() => this.auth.isLoggedIn());
  /** El favorito se guarda por nombre: solo un lugar de la lista puede serlo. */
  readonly destinationName = computed(() => {
    const d = this.destination();
    return d?.kind === 'place' ? d.place.name : null;
  });
  readonly chosenIsFavorite = computed(() =>
    !!this.favorite() && this.favorite()!.destination === this.destinationName());
  readonly favoriteCongestion = computed(() => {
    if (this.result()) return null;
    const sectores = this.favorite()?.congestionSectors ?? [];
    return sectores.length > 0 ? sectores : null;
  });

  /** Nombres pendientes de casar con la lista (historial o favorito pueden llegar antes que ella). */
  private pendingNames: { origin?: string; destination?: string } = {};

  ngOnInit(): void {
    // Repetir búsqueda del historial (RF-07): `?origen=&destino=` llega con nombres.
    const q = this.activatedRoute.snapshot.queryParamMap;
    this.pendingNames = { origin: q.get('origen') ?? undefined, destination: q.get('destino') ?? undefined };

    this.placeService.getPlaces().subscribe({
      next: (places) => {
        this.places.set(places);
        this.resolvePendingNames();
      },
      error: () => this.placesError.set(true),
    });
    this.loadFavorite();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.cuadroEta);
    if (this.relojPulso !== null) clearTimeout(this.relojPulso);
  }

  /** Un nombre del historial o del favorito que ya no existe en la lista se ignora. */
  private resolvePendingNames(): void {
    const places = this.places();
    if (!places.length) return;
    for (const end of ['origin', 'destination'] as const) {
      const name = this.pendingNames[end];
      const target = this.signalFor(end);
      if (!name || target()) continue;
      const place = findExactPlace(places, name);
      if (place) target.set({ kind: 'place', place, label: place.name });
    }
    this.pendingNames = {};
  }

  private signalFor(end: End) {
    return end === 'origin' ? this.origin : this.destination;
  }

  onComboAction(end: End, action: ComboboxAction): void {
    if (action === 'my-location') this.useMyLocation();
    else this.pickDialog().open(end, endPoint(this.signalFor(end)()));
  }

  onMapPicked(e: { which: End; point: LatLngPoint }): void {
    this.signalFor(e.which).set({ kind: 'map', lat: e.point.lat, lng: e.point.lng, label: '🗺️ Punto en el mapa' });
  }

  /**
   * "Mi ubicación": pide el GPS solo cuando el usuario lo elige, nunca en silencio. Si lo
   * niega, falla o tarda más de 8 s, lo dice y deja el campo vacío para escribir.
   */
  useMyLocation(): void {
    this.originHint.set(null);
    if (!('geolocation' in navigator)) {
      this.originHint.set('Este navegador no comparte la ubicación. Escriba de dónde sale.');
      return;
    }
    this.locating.set(true);
    this.originHint.set('Buscando su ubicación…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        this.originHint.set(null);
        this.origin.set({ kind: 'gps', lat: pos.coords.latitude, lng: pos.coords.longitude, label: '📍 Mi ubicación' });
      },
      (err) => {
        this.locating.set(false);
        this.origin.set(null);
        this.originHint.set(err.code === 1
          ? 'No nos dio permiso de ver su ubicación. Escriba de dónde sale o elíjalo en el mapa.'
          : 'No pudimos saber dónde está. Escriba de dónde sale o elíjalo en el mapa.');
      },
      { timeout: GPS_TIMEOUT_MS, maximumAge: 60_000, enableHighAccuracy: true },
    );
  }

  onSubmit(): void {
    const origin = this.origin();
    const destination = this.destination();
    if (!origin || !destination || this.loading()) return;

    this.loading.set(true);
    this.result.set(null);
    this.notFound.set(null);
    this.errorMessage.set(null);
    this.etaMostrado.set(0);
    afterNextRender(() => this.irAlResultado(), { injector: this.injector });

    const params = buildSearchParams(origin, destination);
    const offline = !this.connectivity.isOnline();
    this.run(offline ? this.routeService.searchRouteOffline(params) : this.routeService.searchRoute(params), offline, params);
  }

  private run(request: Observable<RouteSearchResult>, offline: boolean, params: RouteSearchParams): void {
    request.subscribe({
      next: (data) => {
        this.result.set(data);
        this.servedOffline.set(offline);
        this.loading.set(false);
        if (data.estimatedMinutes != null) this.animarEta(data.estimatedMinutes);
      },
      error: (err: HttpErrorResponse) => {
        // status 0 = no salió de la máquina; 503 = Google falló. El offline no lo necesita.
        if (!offline && (err.status === 0 || err.status === 503)) {
          this.run(this.routeService.searchRouteOffline(params), true, params);
          return;
        }
        this.loading.set(false);
        this.handleError(err);
      },
    });
  }

  private handleError(err: HttpErrorResponse): void {
    const body = err.error as RouteNotFoundProblem | undefined;
    if (err.status === 404) {
      const nearest: string[] = [];
      const n = body?.nearestRoutes;
      if (n?.origin) nearest.push(`La ruta más cercana a su origen es ${n.origin.routeName}, a ${n.origin.distanceInMeters} m.`);
      if (n?.destination) nearest.push(`La ruta más cercana a su destino es ${n.destination.routeName}, a ${n.destination.distanceInMeters} m.`);
      this.notFound.set({
        detail: body?.detail ?? 'No hay rutas disponibles que conecten ese origen con ese destino.',
        nearest,
      });
      return;
    }
    if (err.status === 503) {
      this.errorMessage.set('No pudimos buscar la ruta en este momento. Intenta de nuevo en un momento.');
      return;
    }
    this.errorMessage.set(body?.detail ?? 'No se pudo completar la búsqueda. Intenta de nuevo.');
  }

  // ---- Favorito ----
  private loadFavorite(): void {
    if (!this.auth.isLoggedIn()) return;
    this.userService.getFavoriteDestination().subscribe({
      next: (favorite) => {
        if (!favorite) return;
        this.favorite.set(favorite);
        // Solo precarga si el usuario no eligió destino ni viene de repetir una búsqueda.
        if (!this.destination() && !this.pendingNames.destination) {
          this.pendingNames.destination = favorite.destination;
          this.resolvePendingNames();
        }
      },
      error: () => this.favorite.set(null),
    });
  }

  toggleFavorite(): void {
    const name = this.destinationName();
    if (!name || this.savingFavorite()) return;
    this.pulsarFavorito();
    this.savingFavorite.set(true);
    const done = { complete: () => this.savingFavorite.set(false) };
    if (this.chosenIsFavorite()) {
      this.userService.clearFavoriteDestination().subscribe({
        next: () => this.favorite.set(null),
        error: () => this.savingFavorite.set(false),
        ...done,
      });
    } else {
      this.userService.setFavoriteDestination(name).subscribe({
        next: (favorite) => this.favorite.set(favorite),
        error: () => this.savingFavorite.set(false),
        ...done,
      });
    }
  }

  // ---- Presentación ----
  private get movimientoReducido(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Conteo easeOutExpo de 0 al valor real; el arranque se toma del primer cuadro. */
  private animarEta(objetivo: number): void {
    cancelAnimationFrame(this.cuadroEta);
    if (this.movimientoReducido) {
      this.etaMostrado.set(objetivo);
      return;
    }
    const duracion = 650;
    let inicio: number | null = null;
    const paso = (ahora: number) => {
      inicio ??= ahora;
      const avance = Math.min(1, Math.max(0, (ahora - inicio) / duracion));
      const suavizado = avance === 1 ? 1 : 1 - Math.pow(2, -10 * avance);
      this.etaMostrado.set(Math.round(objetivo * suavizado));
      if (avance < 1) this.cuadroEta = requestAnimationFrame(paso);
    };
    this.cuadroEta = requestAnimationFrame(paso);
  }

  /** Lleva la pantalla al resultado: el botón vive abajo y el resultado sale fuera de vista. */
  private irAlResultado(): void {
    const destino = this.zonaResultado().nativeElement;
    if (typeof destino.scrollIntoView !== 'function') return;
    destino.scrollIntoView({ behavior: this.movimientoReducido ? 'auto' : 'smooth', block: 'start' });
  }

  private pulsarFavorito(): void {
    if (this.movimientoReducido) return;
    if (this.relojPulso !== null) clearTimeout(this.relojPulso);
    this.favoritoPulsado.set(true);
    this.relojPulso = setTimeout(() => this.favoritoPulsado.set(false), 500);
  }
}

function endPoint(end: TripEnd | null): LatLngPoint | null {
  if (!end) return null;
  return end.kind === 'place' ? { lat: end.place.lat, lng: end.place.lng } : { lat: end.lat, lng: end.lng };
}

function toResolved(end: TripEnd | null): { lat: number; lng: number; label: string } | null {
  const p = endPoint(end);
  return p && end ? { ...p, label: end.label } : null;
}
