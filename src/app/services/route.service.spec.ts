import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RouteService } from './route.service';
import { environment } from '../../environments/environment';

describe('RouteService', () => {
  let service: RouteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RouteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el listado al endpoint público del backend y devuelve lo que este responde', () => {
    let result: unknown;
    service.getAllPublicRoutes().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/routes`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, name: 'Ruta', type: 'URBANA', neighborhoods: ['A'], fares: [] }]);

    expect(result).toEqual([{ id: 1, name: 'Ruta', type: 'URBANA', neighborhoods: ['A'], fares: [] }]);
  });

  it('pide el detalle por id', () => {
    service.getRouteById('8').subscribe();

    const req = http.expectOne(`${environment.apiUrl}/api/routes/8`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 8, name: 'Ruta', type: 'INTERMUNICIPAL', neighborhoods: [], fares: [] });
  });

  it('propaga el error del backend en vez de inventar datos', () => {
    let status: number | undefined;
    service.getRouteById('999').subscribe({ error: (e) => (status = e.status) });

    http.expectOne(`${environment.apiUrl}/api/routes/999`).flush(null, { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
  });
});
