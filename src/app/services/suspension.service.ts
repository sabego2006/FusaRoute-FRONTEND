import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Suspension, SuspensionFilter, SuspensionRequest } from '../models/suspension.model';

/**
 * Cliente HTTP de las suspensiones temporales de rutas del administrador (RF-12,
 * SCRUM-25). Los errores (400 por campo, 404, 409) llegan como `HttpErrorResponse` y
 * cada pantalla decide cómo mostrarlos.
 */
@Injectable({ providedIn: 'root' })
export class SuspensionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/admin`;

  /** Lista las suspensiones según el estado pedido. */
  list(state: SuspensionFilter = 'all'): Observable<Suspension[]> {
    return this.http.get<Suspension[]>(`${this.base}/suspensions`, {
      params: new HttpParams().set('state', state),
    });
  }

  /** Suspende una ruta. 201; 400 por campo; 404; 409 si la ruta está INACTIVA o se solapa. */
  create(routeId: number, body: SuspensionRequest): Observable<Suspension> {
    return this.http.post<Suspension>(`${this.base}/routes/${routeId}/suspensions`, body);
  }

  /** Reactiva a mano (levanta la suspensión). 404; 409 si ya terminó o ya estaba levantada. */
  lift(id: number): Observable<Suspension> {
    return this.http.delete<Suspension>(`${this.base}/suspensions/${id}`);
  }
}
