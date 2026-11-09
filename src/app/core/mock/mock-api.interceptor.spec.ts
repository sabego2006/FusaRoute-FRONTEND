import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_PLACES, mockApiInterceptor } from './mock-api.interceptor';
import { RouteSearchResult } from '../../models/route.model';

const API = 'https://api.ejemplo.test';

describe('mockApiInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([mockApiInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
  });
  afterEach(() => vi.useRealTimers());

  it('responde los lugares', async () => {
    expect(await firstValueFrom(http.get(`${API}/api/places`))).toEqual(MOCK_PLACES);
  });

  it('responde el catálogo y el detalle', async () => {
    expect(await firstValueFrom(http.get<unknown[]>(`${API}/api/routes`))).toHaveLength(1);
    expect(await firstValueFrom(http.get<{ id: number }>(`${API}/api/routes/14`))).toMatchObject({ id: 14 });
  });

  it('a las 17:10 la búsqueda trae el aviso de congestión; a las 10:00 no', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const buscar = () => firstValueFrom(http.get<RouteSearchResult>(`${API}/api/routes/search`,
      { params: { originPlaceId: 12, destinationPlaceId: 40 } }));
    vi.setSystemTime(new Date(2026, 10, 9, 17, 10));
    const tarde = await buscar();
    expect(tarde.congestionSectors).toHaveLength(1);
    expect(tarde.origin?.label).toBe('Indio');
    vi.setSystemTime(new Date(2026, 10, 9, 10, 0));
    expect((await buscar()).congestionSectors).toEqual([]);
  });

  it('offline no trae tiempo y acepta lat/lng', async () => {
    const r = await firstValueFrom(http.get<RouteSearchResult>(`${API}/api/routes/search/offline`,
      { params: { originLat: 4.33, originLng: -74.37, destinationPlaceId: 40 } }));
    expect(r.estimatedMinutes).toBeNull();
    expect(r.origin?.label).toBe('Su punto de salida');
  });

  it('mismo origen y destino da 404 con ruta cercana; sin puntas da 400', async () => {
    const err404 = await firstValueFrom(http.get(`${API}/api/routes/search`,
      { params: { originPlaceId: 12, destinationPlaceId: 12 } })).catch((e: HttpErrorResponse) => e);
    expect((err404 as HttpErrorResponse).status).toBe(404);
    expect((err404 as HttpErrorResponse).error.nearestRoutes.origin.distanceInMeters).toBe(420);
    const err400 = await firstValueFrom(http.get(`${API}/api/routes/search`)).catch((e: HttpErrorResponse) => e);
    expect((err400 as HttpErrorResponse).status).toBe(400);
  });

  it('deja pasar lo que no simula', () => {
    http.get(`${API}/api/otra-cosa`).subscribe();
    TestBed.inject(HttpTestingController).expectOne(`${API}/api/otra-cosa`).flush({});
  });
});
