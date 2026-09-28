import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Route } from '../models/route.model';

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
}
