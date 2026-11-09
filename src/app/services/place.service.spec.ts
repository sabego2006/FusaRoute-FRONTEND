import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
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

  it('si falla, el siguiente intento vuelve a pedirla', () => {
    service.getPlaces().subscribe({ error: () => undefined });
    http.expectOne(url).flush(null, { status: 500, statusText: 'x' });
    service.getPlaces().subscribe();
    http.expectOne(url).flush([]);
  });
});
