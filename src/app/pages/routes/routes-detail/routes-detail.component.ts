import { Component, OnInit, computed, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RouteService } from '../../../services/route.service';
import { Route } from '../../../models/route.model';
import { formatCop, formatDateEs } from '../../../lib/format';
import { pickNeighborhoodSteps } from '../../../lib/route-steps';

@Component({
  selector: 'app-routes-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './routes-detail.component.html'
})
export class RoutesDetailComponent implements OnInit {
  route = signal<Route | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  steps = computed(() => pickNeighborhoodSteps(this.route()?.neighborhoods ?? []));
  isUrban = computed(() => this.route()?.type === 'URBANA');

  readonly formatCop = formatCop;
  readonly formatDateEs = formatDateEs;

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
