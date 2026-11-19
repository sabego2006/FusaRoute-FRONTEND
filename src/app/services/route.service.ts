import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Route, RouteDetail, RouteSearchParams, RouteSearchResult } from '../models/route.model';
import { retryTransient } from '../lib/retry-transient';

/** Cliente del catálogo público de rutas (RF-15). Ambos endpoints son públicos: no requieren sesión. */
@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private readonly apiUrl = `${environment.apiUrl}/api/routes`;

  constructor(private http: HttpClient) {}

  /**
   * Catálogo completo. Con reintentos (T15): es un GET idempotente y cacheado 10 min por el
   * borde, así que volver a pedirlo tras un corte de red no cuesta nada y evita que un solo
   * corte deje la pantalla en un error del que no se sale.
   */
  getAllPublicRoutes(): Observable<Route[]> {
    return this.http.get<Route[]>(this.apiUrl).pipe(retryTransient());
  }

  /** El detalle trae además el trazado GeoJSON, que el listado no carga por peso. */
  getRouteById(id: string): Observable<RouteDetail> {
    return this.http.get<RouteDetail>(`${this.apiUrl}/${encodeURIComponent(id)}`).pipe(retryTransient());
  }

  /**
   * Busca la mejor ruta entre un origen y un destino (RF-04, SCRUM-54).
   * Con red: el backend cronometra la candidata ganadora contra Google y la entrega con
   * `etaSource: TRAFFIC`; si Google no contesta dentro de su presupuesto, la entrega igual
   * con `ESTIMATED`.
   *
   * **Sin reintentos a propósito** (T15): cada llamada puede gastar una de las 150 consultas
   * diarias a Google. Un fallo de transporte se resuelve cayendo al endpoint offline, que no
   * cuesta cuota, no al repetir esta.
   */
  searchRoute(params: RouteSearchParams): Observable<RouteSearchResult> {
    return this.http.get<RouteSearchResult>(`${this.apiUrl}/search`, { params: searchQueryParams(params) });
  }

  /**
   * Busca la mejor ruta sin conexión (RF-04 parte 2, SCRUM-51).
   * Sin red el backend no puede preguntarle el tiempo a Google, así que elige por el
   * recorrido más corto sobre el trazado propio y devuelve `estimatedMinutes` en null.
   *
   * Con reintentos: no consulta a Google, así que repetirla no gasta cuota.
   */
  searchRouteOffline(params: RouteSearchParams): Observable<RouteSearchResult> {
    return this.http.get<RouteSearchResult>(`${this.apiUrl}/search/offline`, { params: searchQueryParams(params) })
      .pipe(retryTransient());
  }
}

/**
 * Query params de una búsqueda, sin las claves de coordenadas ausentes (SCRUM-130:
 * son opcionales desde que el usuario ya no las escribe a mano). `HttpClient` serializa
 * un valor `undefined` como el texto literal "undefined", que el backend no sabría
 * distinguir de un valor real — mejor omitir la clave por completo.
 */
function searchQueryParams(params: RouteSearchParams): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number>;
}
