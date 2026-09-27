import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RouteService } from '../../../services/route.service';
import { Route } from '../../../models/route.model';

@Component({
  selector: 'app-routes-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './routes-detail.component.html',
  styleUrls: ['./routes-detail.component.css']
})
export class RoutesDetailComponent implements OnInit {
  route = signal<Route | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

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
    this.routeService.getRouteById(id).subscribe({
      next: (data) => {
        this.route.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando detalle:', err);
        this.errorMessage.set('No se pudo cargar el detalle de la ruta.');
        this.loading.set(false);
      }
    });
  }
}
