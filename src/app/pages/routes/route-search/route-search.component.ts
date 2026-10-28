import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RouteService } from '../../../services/route.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { RouteSearchParams, RouteSearchResult } from '../../../models/route.model';
import { ProblemDetail } from '../../../models/auth.model';
import { pickNeighborhoodSteps } from '../../../lib/route-steps';

/**
 * Pantalla de resultado de búsqueda (SCRUM-54): origen/destino, ruta sugerida, última
 * milla y mensaje de "no hay ruta" cuando aplique.
 *
 * El origen/destino pide lat/lng además del barrio porque el backend calcula el
 * tiempo desde el punto exacto, no desde el centro del barrio. Hasta que el mapa
 * (SCRUM-169) esté listo, esas coordenadas se piden como campos numéricos.
 */
@Component({
  selector: 'app-route-search',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './route-search.component.html',
})
export class RouteSearchComponent {
  private readonly fb = inject(FormBuilder);
  private readonly routeService = inject(RouteService);
  private readonly connectivity = inject(ConnectivityService);

  readonly loading = signal(false);
  readonly result = signal<RouteSearchResult | null>(null);
  readonly notFoundMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Que el resultado venga del modo offline se sabe por el dato mismo: el endpoint
  // online siempre trae tiempo estimado, y el offline nunca. No hace falta recordarlo
  // en un signal aparte que podria quedar desincronizado del resultado en pantalla.
  readonly isOnline = this.connectivity.isOnline;
  readonly steps = computed(() => pickNeighborhoodSteps(this.result()?.route.neighborhoods ?? []));
  readonly isUrban = computed(() => this.result()?.route.type === 'URBANA');

  /** En km cuando pasa del kilómetro, que es como se lee de un vistazo. */
  readonly travelDistanceLabel = computed(() => {
    const meters = this.result()?.travelDistanceInMeters;
    if (meters == null) return null;
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
  });

  searchForm = this.fb.group({
    originNeighborhood: ['', Validators.required],
    originLat: [null as number | null, Validators.required],
    originLng: [null as number | null, Validators.required],
    destinationNeighborhood: ['', Validators.required],
    destinationLat: [null as number | null, Validators.required],
    destinationLng: [null as number | null, Validators.required],
  });

  onSubmit(): void {
    if (this.searchForm.invalid) return;

    this.loading.set(true);
    this.result.set(null);
    this.notFoundMessage.set(null);
    this.errorMessage.set(null);

    const params = this.toParams();
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

  private toParams(): RouteSearchParams {
    const value = this.searchForm.getRawValue();
    return {
      originNeighborhood: value.originNeighborhood!,
      originLat: value.originLat!,
      originLng: value.originLng!,
      destinationNeighborhood: value.destinationNeighborhood!,
      destinationLat: value.destinationLat!,
      destinationLng: value.destinationLng!,
    };
  }
}
