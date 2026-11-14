import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminMetrics } from '../models/admin-metrics.model';
import { environment } from '../../environments/environment';

describe('AdminMetricsService', () => {
  let service: AdminMetricsService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/api/admin/metrics`;

  const respuesta: AdminMetrics = {
    totalUsers: 120,
    searchesToday: 37,
    topRoutes: [{ routeId: 3, routeName: 'Centro - Terminal', searches: 19 }],
    pendingComments: 4,
    activeSuspensions: 2,
    generatedAt: '2026-11-13T10:15:30-05:00',
    timezone: 'America/Bogota',
    topRoutesWindowDays: 30,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminMetricsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('200: pide GET /api/admin/metrics y devuelve el cuerpo', () => {
    let recibido: AdminMetrics | undefined;
    service.get().subscribe((m) => (recibido = m));

    const req = http.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush(respuesta);

    expect(recibido).toEqual(respuesta);
  });

  it.each([401, 403])('%i: propaga el error para que la pantalla lo resuelva', (status) => {
    let codigo: number | undefined;
    service.get().subscribe({ error: (e) => (codigo = e.status) });

    http.expectOne(url).flush(null, { status, statusText: 'x' });

    expect(codigo).toBe(status);
  });
});
