import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Route, AuthResponse } from '../models/domain.models';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // --- Autenticación ---
  login(credentials: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, credentials);
  }

  // --- Rutas ---
  getRoutes(): Observable<Route[]> {
    return this.http.get<Route[]>(`${this.baseUrl}/api/routes`);
  }

  getRouteDetail(id: string): Observable<Route> {
    return this.http.get<Route>(`${this.baseUrl}/api/routes/${id}`);
  }

  // --- Salud del sistema (para probar la conexión) ---
  checkHealth(): Observable<{status: string}> {
    return this.http.get<{status: string}>(`${this.baseUrl}/health`);
  }
}
