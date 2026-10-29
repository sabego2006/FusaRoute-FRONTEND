import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { RouteService } from '../../../services/route.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { RouteSearchParams, RouteSearchResult } from '../../../models/route.model';
import { ProblemDetail } from '../../../models/auth.model';
import { RouteStepsComponent } from '../../../components/route-steps/route-steps.component';
import { distinctNeighborhoods } from '../../../lib/neighborhoods';
import { linestringEnds } from '../../../lib/linestring-ends';
import { FareTableComponent } from '../../../components/fare-table/fare-table.component';
import { LetreroComponent } from '../../../components/letrero/letrero.component';
import { MapViewComponent, LatLngPoint } from '../../../components/map-view/map-view.component';
import { MapPointPickerComponent, PickedPoints } from '../../../components/map-point-picker/map-point-picker.component';

/**
 * Pantalla de resultado de búsqueda (SCRUM-54, SCRUM-130): origen/destino, ruta
 * sugerida, última milla y mensaje de "no hay ruta" cuando aplique.
 *
 * Origen y destino se eligen de la lista de barrios del catálogo — el usuario nunca
 * escribe una coordenada (RNF-04: el flujo completo cabe en 4 acciones). En línea, la
 * geolocalización del navegador afina el origen por detrás; sin ella, o sin
 * conexión, el backend deriva un punto aproximado del nombre del barrio.
 */
@Component({
  selector: 'app-route-search',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RouteStepsComponent, FareTableComponent,
            LetreroComponent, MapViewComponent, MapPointPickerComponent],
  templateUrl: './route-search.component.html',
})
export class RouteSearchComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly routeService = inject(RouteService);
  private readonly connectivity = inject(ConnectivityService);

  readonly loading = signal(false);
  readonly result = signal<RouteSearchResult | null>(null);
  readonly notFoundMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly neighborhoods = signal<string[]>([]);
  readonly neighborhoodsError = signal(false);
  /**
   * Si el resultado en pantalla salió del endpoint offline. Antes se derivaba de
   * `estimatedMinutes === null`, pero el online ahora también puede responder sin tiempo
   * (SCRUM-130, Fase 1: cuando Google falla para todas las candidatas se degrada en vez
   * de dar 503). Un signal propio evita confundir ambas situaciones en el mensaje al
   * usuario — "sin conexión" vs. "no pudimos calcular el tiempo ahora".
   */
  readonly servedOffline = signal(false);
  /** Puntos fijados en el mapa, si los hay. Pisan a la geolocalización del origen. */
  readonly picked = signal<PickedPoints>({ origin: null, destination: null });

  readonly isOnline = this.connectivity.isOnline;
  readonly isUrban = computed(() => this.result()?.route.type === 'URBANA');

  // Igual que congestionSectors en el detalle: un backend sin SCRUM-176 desplegado
  // no manda la clave `signs`.
  readonly signs = computed(() => this.result()?.signs ?? []);

  /** En km cuando pasa del kilómetro, que es como se lee de un vistazo. */
  readonly travelDistanceLabel = computed(() => {
    const meters = this.result()?.travelDistanceInMeters;
    if (meters == null) return null;
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
  });

  /**
   * Datos del mapa en el resultado. `null` si la ruta sugerida no tiene trazado o si el
   * backend no mandó la clave (p. ej. versión anterior). Prefiere `boarding`/`dropOff`
   * como marcadores: son dónde el usuario toma y deja la buseta. Si no vienen, cae a
   * los extremos del trazado — la ruta se pinta igual, sin última milla.
   */
  readonly resultMap = computed(() => {
    const r = this.result();
    if (!r?.path) return null;
    const ends = linestringEnds(r.path);
    if (!ends) return null;
    const start: LatLngPoint = r.boarding
      ? { lat: r.boarding.latitude, lng: r.boarding.longitude }
      : ends.start;
    const end: LatLngPoint = r.dropOff
      ? { lat: r.dropOff.latitude, lng: r.dropOff.longitude }
      : ends.end;
    return { path: r.path, start, end };
  });

  searchForm = this.fb.group({
    originNeighborhood: ['', Validators.required],
    destinationNeighborhood: ['', Validators.required],
  });

  ngOnInit(): void {
    this.routeService.getAllPublicRoutes().subscribe({
      next: (routes) => this.neighborhoods.set(distinctNeighborhoods(routes)),
      error: () => this.neighborhoodsError.set(true),
    });
  }

  onSubmit(): void {
    if (this.searchForm.invalid) return;

    this.loading.set(true);
    this.result.set(null);
    this.notFoundMessage.set(null);
    this.errorMessage.set(null);

    const { originNeighborhood, destinationNeighborhood } = this.searchForm.getRawValue();
    const picked = this.picked();
    const base: RouteSearchParams = {
      originNeighborhood: originNeighborhood!,
      destinationNeighborhood: destinationNeighborhood!,
      // Un destino elegido en el mapa es intención explícita del usuario y nunca lo
      // deriva el navegador: viaja tal cual.
      ...(picked.destination ? {
        destinationLat: picked.destination.lat,
        destinationLng: picked.destination.lng,
      } : {}),
    };

    if (picked.origin) {
      // El punto fijado pisa al GPS: si el usuario tocó el mapa, es porque quiere ESE
      // origen y no el que el navegador adivine.
      this.search({ ...base, originLat: picked.origin.lat, originLng: picked.origin.lng });
    } else if (this.isOnline()) {
      // Solo el origen: no existe geolocalización del destino de otra persona. Si el
      // navegador no la soporta, el usuario la niega o se agota el tiempo, se busca
      // igual sin coordenadas — nunca bloquea la búsqueda por esto.
      this.locateOrigin((origin) => this.search({ ...base, ...origin }));
    } else {
      this.search(base);
    }
  }

  onPickedPointsChange(points: PickedPoints): void {
    this.picked.set(points);
  }

  private locateOrigin(onSettled: (origin: Partial<RouteSearchParams>) => void): void {
    if (!('geolocation' in navigator)) {
      onSettled({});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        onSettled({ originLat: position.coords.latitude, originLng: position.coords.longitude }),
      () => onSettled({}),
      { timeout: 5_000 },
    );
  }

  private search(params: RouteSearchParams): void {
    const offline = !this.connectivity.isOnline();
    this.run(offline ? this.routeService.searchRouteOffline(params) : this.routeService.searchRoute(params), offline, params);
  }

  private run(request: Observable<RouteSearchResult>, offline: boolean, params: RouteSearchParams): void {
    request.subscribe({
      next: (data) => {
        this.result.set(data);
        this.servedOffline.set(offline);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        // status 0 = "no salió de la máquina" (navigator.onLine miente a veces).
        // status 503 = Google rechazó/falló para todas las candidatas (Fase 1 ya lo
        // evita en el backend nuevo, pero este reintento cubre un backend viejo todavía
        // desplegado). En ambos casos el offline no necesita a Google y responde.
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
    const body = err.error as ProblemDetail | undefined;
    // El backend responde 404 con ProblemDetail cuando ninguna ruta conecta los dos
    // barrios. Se distingue por el status y no por el texto: el mensaje puede cambiar.
    if (err.status === 404) {
      this.notFoundMessage.set(body?.detail ?? 'No hay rutas disponibles que conecten ese origen con ese destino.');
      return;
    }
    // Caso de PROD 2026-10-29: el backend viejo propagaba el 503 con el texto crudo
    // "Distance Matrix respondio status=REQUEST_DENIED", que al usuario no le dice
    // nada. El 503 ahora dispara un reintento offline (ver `run`); si ESE también
    // falla, mejor un mensaje genérico que el texto técnico de Google.
    if (err.status === 503) {
      this.errorMessage.set('No pudimos buscar la ruta en este momento. Intenta de nuevo en un momento.');
      return;
    }
    this.errorMessage.set(body?.detail ?? 'No se pudo completar la búsqueda. Intenta de nuevo.');
  }
}
