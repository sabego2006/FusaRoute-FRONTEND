import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RouteService } from '../../../services/route.service';
import { Route } from '../../../models/route.model';
import { formatCop } from '../../../lib/format';
import { pickNeighborhoodSteps } from '../../../lib/route-steps';

@Component({
  selector: 'app-routes-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './routes-list.component.html'
})
export class RoutesListComponent implements OnInit {
  routes = signal<Route[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  readonly pickNeighborhoodSteps = pickNeighborhoodSteps;

  constructor(private routeService: RouteService) {}

  ngOnInit() {
    this.loadRoutes();
  }

  loadRoutes() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.routeService.getAllPublicRoutes().subscribe({
      next: (data) => {
        this.routes.set(data);
        this.loading.set(false);
      },
      error: () => {
        // Sin datos de respaldo: mostrar rutas inventadas cuando el backend falla sería mentirle al usuario.
        this.errorMessage.set('No se pudo cargar el catálogo de rutas. Intenta de nuevo en un momento.');
        this.loading.set(false);
      }
    });
  }

  /** Resumen de tarifa para la tarjeta: precio único (urbana) o el más bajo, "Desde" (intermunicipal). */
  fareLabel(route: Route): string {
    if (route.fares.length === 0) {
      return 'Tarifa no disponible';
    }
    const lowest = Math.min(...route.fares.map((f) => f.amount));
    return route.type === 'URBANA' ? formatCop(lowest) : `Desde ${formatCop(lowest)}`;
  }
}
