import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdminRouteService } from './admin-route.service';
import { AdminRouteDetail, AdminRouteRequest, AdminRouteSummary } from '../models/admin-route.model';
import { environment } from '../../environments/environment';

describe('AdminRouteService', () => {
  let service: AdminRouteService;
  let http: HttpTestingController;

  const base = `${environment.apiUrl}/api/admin/routes`;

  const resumen: AdminRouteSummary = {
    id: 7,
    name: 'Centro - Terminal',
    type: 'URBANA',
    status: 'ACTIVA',
    hasPath: true,
    neighborhoodsCount: 3,
    currentFare: 2600,
    updatedAt: '2026-11-10T15:00:00-05:00',
  };

  const detalle: AdminRouteDetail = {
    ...resumen,
    pathGeoJson: { type: 'LineString', coordinates: [[-74.37, 4.34], [-74.36, 4.35]] },
    neighborhoods: ['Centro', 'Terminal'],
    fares: [{ amount: 2600, referencePoint: null, validFrom: '2026-11-01' }],
    signFile: null,
  };

  const cuerpo: AdminRouteRequest = {
    name: 'Centro - Terminal',
    type: 'URBANA',
    neighborhoods: ['Centro', 'Terminal'],
    fares: [{ amount: 2600 }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminRouteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list envía GET /api/admin/routes y devuelve el resumen con el estado', () => {
    let result: AdminRouteSummary[] | undefined;
    service.list().subscribe((r) => (result = r));

    const req = http.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([resumen, { ...resumen, id: 8, status: 'INACTIVA' }]);

    expect(result?.map((r) => r.status)).toEqual(['ACTIVA', 'INACTIVA']);
  });

  it('get envía GET /api/admin/routes/{id}', () => {
    let result: AdminRouteDetail | undefined;
    service.get(7).subscribe((r) => (result = r));

    const req = http.expectOne(`${base}/7`);
    expect(req.request.method).toBe('GET');
    req.flush(detalle);

    expect(result).toEqual(detalle);
  });

  it('get propaga el 404', () => {
    let status = 0;
    service.get(99).subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });

    http.expectOne(`${base}/99`).flush({ status: 404, detail: 'No existe' }, { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
  });

  it('create envía POST con el cuerpo tal cual y espera 201', () => {
    let result: AdminRouteDetail | undefined;
    service.create(cuerpo).subscribe((r) => (result = r));

    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    req.flush(detalle, { status: 201, statusText: 'Created' });

    expect(result?.id).toBe(7);
  });

  it('create propaga el 400 con los errores por campo', () => {
    let error: HttpErrorResponse | undefined;
    service.create(cuerpo).subscribe({ error: (e: HttpErrorResponse) => (error = e) });

    http.expectOne(base).flush(
      { status: 400, detail: 'Datos inválidos', errors: [{ field: 'name', message: 'muy corto' }] },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(error?.status).toBe(400);
    expect((error?.error as { errors: { field: string }[] }).errors[0].field).toBe('name');
  });

  it('create propaga el 409 de nombre repetido', () => {
    let status = 0;
    service.create(cuerpo).subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });

    http.expectOne(base).flush({ status: 409, detail: 'Nombre repetido' }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
  });

  it('update envía PUT /api/admin/routes/{id} con el cuerpo', () => {
    let result: AdminRouteDetail | undefined;
    service.update(7, cuerpo).subscribe((r) => (result = r));

    const req = http.expectOne(`${base}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(cuerpo);
    req.flush(detalle);

    expect(result).toEqual(detalle);
  });

  it('update propaga el 404 y el 409', () => {
    const statuses: number[] = [];
    service.update(7, cuerpo).subscribe({ error: (e: HttpErrorResponse) => statuses.push(e.status) });
    service.update(8, cuerpo).subscribe({ error: (e: HttpErrorResponse) => statuses.push(e.status) });

    http.expectOne(`${base}/7`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${base}/8`).flush({}, { status: 409, statusText: 'Conflict' });

    expect(statuses).toEqual([404, 409]);
  });

  it('remove envía DELETE /api/admin/routes/{id} y completa con 204', () => {
    let completed = false;
    service.remove(7).subscribe({ complete: () => (completed = true) });

    const req = http.expectOne(`${base}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('remove propaga el 404', () => {
    let status = 0;
    service.remove(7).subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });

    http.expectOne(`${base}/7`).flush({}, { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
  });

  it('restore envía POST /api/admin/routes/{id}/restore', () => {
    let result: AdminRouteDetail | undefined;
    service.restore(7).subscribe((r) => (result = r));

    const req = http.expectOne(`${base}/7/restore`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...detalle, status: 'ACTIVA' });

    expect(result?.status).toBe('ACTIVA');
  });

  it('restore propaga el 404 y el 409', () => {
    const statuses: number[] = [];
    service.restore(7).subscribe({ error: (e: HttpErrorResponse) => statuses.push(e.status) });
    service.restore(8).subscribe({ error: (e: HttpErrorResponse) => statuses.push(e.status) });

    http.expectOne(`${base}/7/restore`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${base}/8/restore`).flush({}, { status: 409, statusText: 'Conflict' });

    expect(statuses).toEqual([404, 409]);
  });
});
