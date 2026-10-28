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

  it('la búsqueda con red manda barrio y coordenadas al endpoint online', () => {
    service
      .searchRoute({
        originNeighborhood: 'Centro',
        originLat: 4.3433,
        originLng: -74.3661,
        destinationNeighborhood: 'La Pampa',
        destinationLat: 4.33,
        destinationLng: -74.36
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/api/routes/search`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('originNeighborhood')).toBe('Centro');
    expect(req.request.params.get('originLat')).toBe('4.3433');
    req.flush({ route: {}, estimatedMinutes: 18, travelDistanceInMeters: 2400, boarding: null, dropOff: null });
  });

  it('la búsqueda sin red va a /search/offline, que es otro endpoint', () => {
    let result: unknown;
    service
      .searchRouteOffline({
        originNeighborhood: 'Centro',
        originLat: 4.3433,
        originLng: -74.3661,
        destinationNeighborhood: 'La Pampa',
        destinationLat: 4.33,
        destinationLng: -74.36
      })
      .subscribe((r) => (result = r));

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/api/routes/search/offline`);
    expect(req.request.method).toBe('GET');
    req.flush({ route: {}, estimatedMinutes: null, travelDistanceInMeters: 2400, boarding: null, dropOff: null });

    // Sin red el backend no consulta a Google, así que no manda tiempo estimado.
    expect((result as { estimatedMinutes: number | null }).estimatedMinutes).toBeNull();
  });

  it('propaga el error del backend en vez de inventar datos', () => {
    let status: number | undefined;
    service.getRouteById('999').subscribe({ error: (e) => (status = e.status) });

    http.expectOne(`${environment.apiUrl}/api/routes/999`).flush(null, { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
  });
});
