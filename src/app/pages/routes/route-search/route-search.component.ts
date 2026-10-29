import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RouteService } from '../../../services/route.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { RouteSearchParams, RouteSearchResult } from '../../../models/route.model';
import { ProblemDetail } from '../../../models/auth.model';
import { RouteStepsComponent } from '../../../components/route-steps/route-steps.component';
import { distinctNeighborhoods } from '../../../lib/neighborhoods';
import { FareTableComponent } from '../../../components/fare-table/fare-table.component';
import { LetreroComponent } from '../../../components/letrero/letrero.component';

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
  imports: [ReactiveFormsModule, RouteStepsComponent, FareTableComponent, LetreroComponent],
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

  // Que el resultado venga del modo offline se sabe por el dato mismo: el endpoint
  // online siempre trae tiempo estimado, y el offline nunca. No hace falta recordarlo
  // en un signal aparte que podria quedar desincronizado del resultado en pantalla.
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
    const base: RouteSearchParams = {
      originNeighborhood: originNeighborhood!,
      destinationNeighborhood: destinationNeighborhood!,
    };

    if (this.isOnline()) {
      // Solo el origen: no existe geolocalización del destino de otra persona. Si el
      // navegador no la soporta, el usuario la niega o se agota el tiempo, se busca
      // igual sin coordenadas — nunca bloquea la búsqueda por esto.
      this.locateOrigin((origin) => this.search({ ...base, ...origin }));
    } else {
      this.search(base);
    }
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
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        // status 0 es "no salió de la máquina". El navegador puede reportar que hay
        // red cuando en realidad no hay internet, así que en vez de darle un error al
        // usuario se reintenta por el endpoint offline, que no necesita salir a Google.
        if (!offline && err.status === 0) {
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
    this.errorMessage.set(body?.detail ?? 'No se pudo completar la búsqueda. Intenta de nuevo.');
  }
}
