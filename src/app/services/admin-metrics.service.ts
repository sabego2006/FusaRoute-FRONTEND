import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AdminMetrics } from '../models/admin-metrics.model';

/**
 * Cliente HTTP del panel de métricas del administrador (RF-13, SCRUM-26).
 *
 * Responde 401 sin sesión y 403 sin rol ADMIN; el 401 lo resuelve `authInterceptor`
 * y el 403 lo muestra la pantalla. El backend recalcula todo en cada GET (sin caché),
 * así que volver a llamar equivale a "recargar".
 */
@Injectable({ providedIn: 'root' })
export class AdminMetricsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/admin/metrics`;

  get(): Observable<AdminMetrics> {
    return this.http.get<AdminMetrics>(this.url);
  }
}
