import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

/** Verificación de salud del backend. */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly healthUrl = `${environment.apiUrl}/health`;

  constructor(private http: HttpClient) {}

  checkHealth(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(this.healthUrl);
  }
}
