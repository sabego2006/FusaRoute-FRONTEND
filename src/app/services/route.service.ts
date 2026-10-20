import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Route, RouteSearchParams, RouteSearchResult } from '../models/route.model';

/** Cliente del catálogo público de rutas (RF-15). Ambos endpoints son públicos: no requieren sesión. */
@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private readonly apiUrl = `${environment.apiUrl}/api/routes`;

  constructor(private http: HttpClient) {}

  getAllPublicRoutes(): Observable<Route[]> {
    return this.http.get<Route[]>(this.apiUrl);
  }

  getRouteById(id: string): Observable<Route> {
    return this.http.get<Route>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }

  /**
   * Busca la mejor ruta entre un origen y un destino (RF-04, SCRUM-54).
   * El controller ya existe en la rama feature/SCRUM-53-route-latency-monitoring del
   * backend; esta llamada funciona en cuanto esa rama se apruebe y llegue a main.
   */
  searchRoute(params: RouteSearchParams): Observable<RouteSearchResult> {
    return this.http.get<RouteSearchResult>(`${this.apiUrl}/search`, { params: { ...params } });
  }
}
