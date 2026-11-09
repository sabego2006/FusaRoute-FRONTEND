import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RIDES_STORAGE_KEY, RideService } from './ride.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { Ride, RideDraft } from '../models/ride.model';

const URL = `${environment.apiUrl}/api/users/me/rides`;

function draft(n = 0): RideDraft {
  return {
    routeId: 14, routeName: 'Centro - Galería - Terminal', signFile: 'CENTRO_GALERIA_TERMINAL',
    destinationLabel: `Destino ${n}`, destinationPlaceId: 31, destinationLat: 4.3459, destinationLng: -74.3779,
    originLabel: 'Indio',
  };
}

function ride(id: number): Ride {
  return { id, routeId: 14, routeName: 'R', signFile: null, destinationLabel: `D${id}`, destinationPlaceId: null,
    destinationLat: 4.3, destinationLng: -74.3, originLabel: 'Indio', boardedAt: '2026-11-09T17:42:00-05:00' };
}

describe('RideService', () => {
  const loggedIn = signal(false);
  let service: RideService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    loggedIn.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthService, useValue: { isLoggedIn: loggedIn } },
      ],
    });
    service = TestBed.inject(RideService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('sin sesión (navegador)', () => {
    it('guarda en localStorage con la clave versionada y no llama al backend', () => {
      let saved: Ride | undefined;
      service.board(draft(1)).subscribe((r) => (saved = r));

      expect(saved?.destinationLabel).toBe('Destino 1');
      const stored = JSON.parse(localStorage.getItem(RIDES_STORAGE_KEY)!) as Ride[];
      expect(stored).toHaveLength(1);
      expect(stored[0].signFile).toBe('CENTRO_GALERIA_TERMINAL');
      expect(service.lastRide()?.destinationLabel).toBe('Destino 1');
      http.expectNone(URL);
    });

    it('load lee lo guardado en el navegador', () => {
      localStorage.setItem(RIDES_STORAGE_KEY, JSON.stringify([ride(2), ride(1)]));
      service.load();
      expect(service.rides().map((r) => r.id)).toEqual([2, 1]);
      http.expectNone(URL);
    });

    it('conserva máximo 10, del más nuevo al más viejo', () => {
      vi.spyOn(Date, 'now').mockImplementation((() => { let t = 1000; return () => ++t; })());
      for (let i = 0; i < 11; i++) service.board(draft(i)).subscribe();

      expect(service.rides()).toHaveLength(10);
      expect(service.rides()[0].destinationLabel).toBe('Destino 10');
      expect(service.rides().map((r) => r.destinationLabel)).not.toContain('Destino 0');
      expect((JSON.parse(localStorage.getItem(RIDES_STORAGE_KEY)!) as Ride[])).toHaveLength(10);
    });

    it('si localStorage falla al escribir, el viaje igual queda en pantalla', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
      let saved: Ride | undefined;
      service.board(draft(1)).subscribe((r) => (saved = r));

      expect(saved).toBeDefined();
      expect(service.lastRide()?.destinationLabel).toBe('Destino 1');
    });

    it('si localStorage falla al leer, arranca sin historial y sin romperse', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
      expect(() => service.load()).not.toThrow();
      expect(service.rides()).toEqual([]);
    });

    it('ignora lo guardado que no tiene el formato de un viaje', () => {
      localStorage.setItem(RIDES_STORAGE_KEY, JSON.stringify([{ basura: true }, ride(1), 'x']));
      service.load();
      expect(service.rides().map((r) => r.id)).toEqual([1]);

      localStorage.setItem(RIDES_STORAGE_KEY, '{no es json');
      service.load();
      expect(service.rides()).toEqual([]);
    });
  });

  describe('con sesión (cuenta)', () => {
    beforeEach(() => loggedIn.set(true));

    it('load pide GET /api/users/me/rides', () => {
      service.load();
      http.expectOne({ method: 'GET', url: URL }).flush([ride(5), ride(4)]);
      expect(service.lastRide()?.id).toBe(5);
    });

    it('board hace POST con el contrato y no escribe en el navegador', () => {
      let saved: Ride | undefined;
      service.board(draft(1)).subscribe((r) => (saved = r));

      const req = http.expectOne({ method: 'POST', url: URL });
      expect(req.request.body).toEqual({
        routeId: 14, destinationLabel: 'Destino 1', destinationPlaceId: 31,
        destinationLat: 4.3459, destinationLng: -74.3779, originLabel: 'Indio',
      });
      req.flush(ride(9), { status: 201, statusText: 'Created' });

      expect(saved?.id).toBe(9);
      expect(service.lastRide()?.id).toBe(9);
      expect(localStorage.getItem(RIDES_STORAGE_KEY)).toBeNull();
    });

    it('el tope de 10 también se respeta al agregar el viaje nuevo en pantalla', () => {
      service.load();
      http.expectOne(URL).flush(Array.from({ length: 10 }, (_, i) => ride(10 - i)));
      service.board(draft()).subscribe();
      http.expectOne({ method: 'POST', url: URL }).flush(ride(11));

      expect(service.rides()).toHaveLength(10);
      expect(service.rides()[0].id).toBe(11);
      expect(service.rides().map((r) => r.id)).not.toContain(1);
    });

    it('si el backend falla al guardar, el error llega a quien tocó el botón', () => {
      let failed = false;
      service.board(draft()).subscribe({ error: () => (failed = true) });
      http.expectOne(URL).flush(null, { status: 500, statusText: 'Error' });
      expect(failed).toBe(true);
      expect(service.rides()).toEqual([]);
    });

    it('si el backend falla al cargar, queda sin historial', () => {
      service.load();
      http.expectOne(URL).flush(null, { status: 500, statusText: 'Error' });
      expect(service.rides()).toEqual([]);
    });
  });
});
