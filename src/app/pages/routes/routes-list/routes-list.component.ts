import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteService } from '../../../services/route.service';
import { Route } from '../../../models/route.model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-routes-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './routes-list.component.html',
  styleUrls: ['./routes-list.component.css']
})
export class RoutesListComponent implements OnInit {
  routes = signal<Route[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

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
      error: (err) => {
        console.log('[RoutesList] Backend no disponible, usando datos simulados (Mocks)');
        // Implementación de Mocking: si el backend falla, cargamos los datos de prueba
        this.routeService.getMockRoutes().subscribe(mocks => {
          this.routes.set(mocks);
          this.loading.set(false);
        });
      }
    });
  }
}
