import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { RouteService } from '../../../services/route.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { Route } from '../../../models/route.model';
import { formatCop } from '../../../lib/format';
import { pickNeighborhoodSteps } from '../../../lib/route-steps';
import { municipalityOf } from '../../../lib/municipality';
import { LetreroComponent } from '../../../components/letrero/letrero.component';

@Component({
  selector: 'app-routes-list',
  standalone: true,
  imports: [RouterLink, LetreroComponent],
  templateUrl: './routes-list.component.html'
})
export class RoutesListComponent implements OnInit {
  private readonly routeService = inject(RouteService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly destroyRef = inject(DestroyRef);

  routes = signal<Route[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  /** `true` mientras se espera a que vuelva la red para reintentar solo. */
  readonly waitingForNetwork = signal(false);

  readonly pickNeighborhoodSteps = pickNeighborhoodSteps;
  /** Chip de municipio por tarjeta (T05, R5). */
  readonly municipalityOf = municipalityOf;

  ngOnInit() {
    this.loadRoutes();
  }

  loadRoutes() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.waitingForNetwork.set(false);

    // El servicio ya reintenta dos veces con espera creciente ante un corte de red (T15);
    // si llega acá, los tres intentos fallaron.
    this.routeService.getAllPublicRoutes().subscribe({
      next: (data) => {
        this.routes.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        // Si lo que faltó fue red, esto NO es un error: es una espera con reintento
        // automático, y decirle "no se pudo" a alguien cuyo internet va a volver en dos
        // segundos es mentirle (T15).
        if (!this.connectivity.isOnline()) {
          this.waitingForNetwork.set(true);
          this.connectivity.whenOnlineAgain()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.loadRoutes());
          return;
        }
        // Sin datos de respaldo: mostrar rutas inventadas cuando el backend falla sería mentirle al usuario.
        this.errorMessage.set('No se pudo cargar el catálogo de rutas. Intenta de nuevo en un momento.');
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
