import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AdminRouteDetail,
  AdminRouteRequest,
  AdminRouteSummary,
} from '../models/admin-route.model';

/**
 * Cliente HTTP de la gestión de rutas del administrador (RF-11, SCRUM-24).
 *
 * Es el único lugar del frontend que habla con `/api/admin/routes`. El JWT lo agrega
 * el interceptor existente; lo que impide que un usuario normal llegue aquí no es este
 * archivo sino Spring Security, que responde 403 sin rol ADMIN.
 *
 * Los errores (400 por campo, 404, 409) **no se traducen aquí**: llegan como
 * `HttpErrorResponse` y cada pantalla decide cómo mostrarlos, porque el mismo 409 es
 * "nombre repetido" al guardar y "no se puede restaurar" al restaurar.
 */
@Injectable({ providedIn: 'root' })
export class AdminRouteService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/admin/routes`;

  /** Todas las rutas, **incluidas las inactivas**, cada una con su estado. */
  list(): Observable<AdminRouteSummary[]> {
    return this.http.get<AdminRouteSummary[]>(this.url);
  }

  /** Detalle completo de una ruta para editarla. 404 si no existe. */
  get(id: number): Observable<AdminRouteDetail> {
    return this.http.get<AdminRouteDetail>(`${this.url}/${id}`);
  }

  /** Crea una ruta. 201 con el detalle; 400 por campo; 409 si el nombre ya existe. */
  create(body: AdminRouteRequest): Observable<AdminRouteDetail> {
    return this.http.post<AdminRouteDetail>(this.url, body);
  }

  /**
   * Reemplaza una ruta. Si cambia la tarifa, el backend actualiza la fecha de
   * vigencia: aquí no se calcula nada.
   */
  update(id: number, body: AdminRouteRequest): Observable<AdminRouteDetail> {
    return this.http.put<AdminRouteDetail>(`${this.url}/${id}`, body);
  }

  /**
   * "Elimina" la ruta: es un **soft delete**, el backend la pasa a INACTIVA y responde
   * 204. Se puede deshacer con `restore`.
   */
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Vuelve una ruta INACTIVA a su estado anterior. 409 si no se puede restaurar. */
  restore(id: number): Observable<AdminRouteDetail> {
    return this.http.post<AdminRouteDetail>(`${this.url}/${id}/restore`, {});
  }
}
