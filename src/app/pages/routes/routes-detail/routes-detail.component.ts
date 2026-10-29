import { Component, OnInit, computed, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RouteService } from '../../../services/route.service';
import { RouteDetail } from '../../../models/route.model';
import { MapViewComponent, LatLngPoint } from '../../../components/map-view/map-view.component';
import { RouteStepsComponent } from '../../../components/route-steps/route-steps.component';
import { LetreroComponent } from '../../../components/letrero/letrero.component';
import { formatCop, formatDateEs, formatTime } from '../../../lib/format';

@Component({
  selector: 'app-routes-detail',
  standalone: true,
  imports: [RouterLink, MapViewComponent, RouteStepsComponent, LetreroComponent],
  templateUrl: './routes-detail.component.html'
})
export class RoutesDetailComponent implements OnInit {
  route = signal<RouteDetail | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  isUrban = computed(() => this.route()?.type === 'URBANA');

  // El `?? []` cubre un backend sin RF-09 desplegado, que no manda la clave. Se hace aquí
  // y no con `?.` en la plantilla porque el tipo dice que siempre viene (NG8107).
  congestionSectors = computed(() => this.route()?.congestionSectors ?? []);

  // Mismo motivo que arriba: un backend sin SCRUM-176 desplegado no manda `signs`.
  signs = computed(() => this.route()?.signs ?? []);

  /**
   * Todo lo que el mapa necesita, o null mientras la ruta no tenga trazado cargado.
   * Va junto en un solo computed para que la plantilla lo resuelva con un unico @if:
   * los tres valores aparecen y desaparecen a la vez.
   *
   * Los extremos del trazado se usan como marcadores de inicio y fin del recorrido.
   * Ojo: GeoJSON guarda [longitud, latitud], y Google Maps espera {lat, lng}.
   */
  readonly mapData = computed(() => {
    const path = this.route()?.path;
    if (!path?.coordinates.length) return null;

    const toPoint = ([lng, lat]: [number, number]): LatLngPoint => ({ lat, lng });
    return {
      path,
      start: toPoint(path.coordinates[0]),
      end: toPoint(path.coordinates[path.coordinates.length - 1])
    };
  });

  readonly formatCop = formatCop;
  readonly formatDateEs = formatDateEs;
  readonly formatTime = formatTime;

  constructor(
    private routeService: RouteService,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit() {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    if (id) {
      this.loadRoute(id);
    } else {
      this.errorMessage.set('ID de ruta no proporcionado.');
      this.loading.set(false);
    }
  }

  loadRoute(id: string) {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.routeService.getRouteById(id).subscribe({
      next: (data) => {
        this.route.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        // 404 también cubre una ruta suspendida: el backend no revela que existe.
        this.errorMessage.set(
          err.status === 404
            ? 'La ruta no existe o no está disponible.'
            : 'No se pudo cargar el detalle de la ruta.'
        );
        this.loading.set(false);
      }
    });
  }
}
