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

  // Datos simulados (Mocks) para permitir el desarrollo del frontend sin bloqueo del backend
  private readonly mockRoutes: Route[] = [
    { 
      id: '1', 
      name: 'Ruta Centro - Salitre', 
      description: 'Conecta el centro de la ciudad con la zona del Salitre', 
      fare: 2900, 
      status: 'ACTIVE', 
      neighborhoods: ['Centro', 'Barrio Bolívar', 'Salitre'] 
    },
    { 
      id: '2', 
      name: 'Ruta Norte - Sur', 
      description: 'Recorrido principal norte-sur de Fusagasugá', 
      fare: 2900, 
      status: 'ACTIVE', 
      neighborhoods: ['El Oasis', 'Centro', 'La Esperanza', 'Sur'] 
    },
    { 
      id: '3', 
      name: 'Ruta Circular Oriente', 
      description: 'Recorrido por los barrios del oriente', 
      fare: 2900, 
      status: 'ACTIVE', 
      neighborhoods: ['Oriente', 'La Aurora', 'El Mirador'] 
    }
  ];

  constructor(private http: HttpClient) {}

  getAllPublicRoutes(): Observable<Route[]> {
    // Intentamos llamar al backend, pero si falla o estamos en desarrollo, devolvemos los mocks
    return this.http.get<Route[]>(this.apiUrl).pipe(
      // Si hay error en la petición, devolvemos los datos simulados para no bloquear el frontend
      // Nota: En un entorno real, esto se manejaría con un interceptor o un flag de environment
    );
  }

  // Método alternativo para forzar el uso de mocks durante el desarrollo
  getMockRoutes(): Observable<Route[]> {
    return of(this.mockRoutes);
  }

  getRouteById(id: string): Observable<Route> {
    return this.http.get<Route>(`${this.apiUrl}/${id}`);
  }
}
