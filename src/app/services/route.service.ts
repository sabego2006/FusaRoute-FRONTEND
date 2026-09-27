import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, of } from 'rxjs';
import { Route } from '../models/route.model';

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private readonly apiUrl = `${environment.apiUrl}/api/routes`;

  // Datos empíricos proporcionados por el experto (Usuario)
  private readonly mockRoutes: Route[] = [
    { 
      id: '1', 
      name: 'Terminal - Gaitán', 
      description: 'Mejor ruta para llegar a la comuna norte desde la terminal. Recorrido estratégico por puntos comerciales y educativos.', 
      fare: 2600, 
      status: 'ACTIVE', 
      neighborhoods: [
        'Terminal', 
        'Centro Comercial Avenida', 
        'Avenida de las Palmas', 
        'Ara (Antiguo Colsubsidio)', 
        'Calle Caliente', 
        'Centro de Integración Infantil', 
        'Escuela Julio Sabogal', 
        'Gaitán'
      ] 
    },
    { 
      id: '2', 
      name: 'Cedritos - Siboney', 
      description: 'Ruta extensa que conecta la zona de Cedritos con Siboney, pasando por la Universidad y puntos estratégicos del centro.', 
      fare: 2600, 
      status: 'ACTIVE', 
      neighborhoods: [
        'Carrera 5', 
        'Chorro Padilla', 
        'Avenida de las Palmas', 
        'Carrera 8 (Panadería Filipo)', 
        'Fiscalía', 
        'Colegio Carlos Lozano', 
        'Universidad de Cundinamarca', 
        'Manila', 
        'D1 Balmoral', 
        'Calle 22', 
        'El Obrero (Puesto de Salud)', 
        'Centro Comercial San Fernando', 
        'Contigo con Todo'
      ] 
    }
  ];

  constructor(private http: HttpClient) {}

  getAllPublicRoutes(): Observable<Route[]> {
    return this.http.get<Route[]>(this.apiUrl);
  }

  getRouteById(id: string): Observable<Route> {
    // Priorizar la búsqueda en los mocks para asegurar que la información empírica se vea
    const route = this.mockRoutes.find(r => r.id === id);
    return route ? of(route) : this.http.get<Route>(`${this.apiUrl}/${id}`);
  }

  getMockRoutes(): Observable<Route[]> {
    return of(this.mockRoutes);
  }
}
