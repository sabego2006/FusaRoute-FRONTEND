import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouteService } from '../../../services/route.service';
import { RouteSearchResult } from '../../../models/route.model';
import { ProblemDetail } from '../../../models/auth.model';
import { pickNeighborhoodSteps } from '../../../lib/route-steps';

/**
 * Pantalla de resultado de búsqueda (SCRUM-54): origen/destino, ruta sugerida, tiempo
 * estimado y mensaje de "no hay ruta" cuando aplique.
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

  readonly searched = signal(false);
  readonly loading = signal(false);
  readonly result = signal<RouteSearchResult | null>(null);
  readonly notFoundMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly steps = computed(() => pickNeighborhoodSteps(this.result()?.route.neighborhoods ?? []));
  readonly isUrban = computed(() => this.result()?.route.type === 'URBANA');

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

    this.searched.set(true);
    this.loading.set(true);
    this.result.set(null);
    this.notFoundMessage.set(null);
    this.errorMessage.set(null);

    const value = this.searchForm.getRawValue();
    this.routeService
      .searchRoute({
        originNeighborhood: value.originNeighborhood!,
        originLat: value.originLat!,
        originLng: value.originLng!,
        destinationNeighborhood: value.destinationNeighborhood!,
        destinationLat: value.destinationLat!,
        destinationLng: value.destinationLng!,
      })
      .subscribe({
        next: (data) => {
          this.result.set(data);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          const body = err.error as ProblemDetail | undefined;
          if (body?.detail?.toLowerCase().includes('no hay rutas disponibles')) {
            this.notFoundMessage.set(body.detail);
          } else {
            this.errorMessage.set(body?.detail ?? 'No se pudo completar la búsqueda. Intenta de nuevo.');
          }
        },
      });
  }
}
