import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaceService } from './place.service';
import { environment } from '../../environments/environment';

describe('PlaceService', () => {
  let service: PlaceService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/api/places`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlaceService);
    http = TestBed.inject(HttpTestingController);
  });

  it('pide los lugares una sola vez por sesión', () => {
    const got: unknown[] = [];
    service.getPlaces().subscribe((p) => got.push(p));
    service.getPlaces().subscribe((p) => got.push(p));
    http.expectOne(url).flush([{ id: 1 }]);
    service.getPlaces().subscribe((p) => got.push(p));
    http.expectNone(url);
    expect(got).toHaveLength(3);
  });

  it('un 404 no se reintenta, y el siguiente intento vuelve a pedirla', () => {
    // 404 no es transitorio: se propaga de una y se olvida la petición cacheada.
    service.getPlaces().subscribe({ error: () => undefined });
    http.expectOne(url).flush(null, { status: 404, statusText: 'x' });
    http.expectNone(url);

    service.getPlaces().subscribe();
    http.expectOne(url).flush([]);
  });

  // T15 (SCRUM-199): sin la lista de lugares el buscador queda inservible.
  it('si la petición se corta, se reintenta sola y entrega los lugares', async () => {
    let got: unknown;
    service.getPlaces().subscribe((p) => (got = p));

    http.expectOne(url).error(new ProgressEvent('error'), { status: 0 });

    const segundo = await vi.waitFor(() => http.expectOne(url), { timeout: 3000 });
    segundo.flush([{ id: 1 }]);

    expect(got).toHaveLength(1);
  });

  it('agotados los reintentos, propaga el error y olvida la petición', async () => {
    let fallo: unknown;
    service.getPlaces().subscribe({ error: (e) => (fallo = e) });

    http.expectOne(url).error(new ProgressEvent('error'), { status: 0 });
    (await vi.waitFor(() => http.expectOne(url), { timeout: 3000 })).error(new ProgressEvent('error'), { status: 0 });
    (await vi.waitFor(() => http.expectOne(url), { timeout: 3000 })).error(new ProgressEvent('error'), { status: 0 });

    await vi.waitFor(() => expect(fallo).toBeDefined());
    // Olvidada: el próximo intento vuelve a pedirla desde cero.
    service.getPlaces().subscribe({ error: () => undefined });
    http.expectOne(url).flush([]);
  });
});
