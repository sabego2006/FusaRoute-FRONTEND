import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SuspensionService } from './suspension.service';
import { NotificationService } from './notification.service';
import { Suspension } from '../models/suspension.model';
import { environment } from '../../environments/environment';

const api = environment.apiUrl;
const sus: Suspension = {
  id: 7, routeId: 12, routeName: 'Centro', startsAt: '2026-11-20T13:00:00Z', endsAt: '2026-11-23T01:00:00Z',
  reason: null, liftedAt: null, state: 'ACTIVE',
};

describe('SuspensionService / NotificationService', () => {
  let http: HttpTestingController;
  let service: SuspensionService;
  let notifications: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SuspensionService);
    notifications = TestBed.inject(NotificationService);
  });
  afterEach(() => http.verify());

  it('list pide el estado indicado', () => {
    let got: Suspension[] = [];
    service.list('upcoming').subscribe((l) => (got = l));
    const req = http.expectOne(`${api}/api/admin/suspensions?state=upcoming`);
    expect(req.request.method).toBe('GET');
    req.flush([sus]);
    expect(got).toEqual([sus]);
  });

  it('list usa "all" por defecto', () => {
    service.list().subscribe();
    http.expectOne(`${api}/api/admin/suspensions?state=all`).flush([]);
  });

  it('create hace POST a la ruta con el cuerpo', () => {
    const body = { startsAt: '2026-11-20T08:00:00-05:00', endsAt: '2026-11-22T20:00:00-05:00', reason: 'Obras' };
    service.create(12, body).subscribe();
    const req = http.expectOne(`${api}/api/admin/routes/12/suspensions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(sus, { status: 201, statusText: 'Created' });
  });

  it('create deja pasar el 409 sin traducirlo', () => {
    let status = 0;
    service.create(12, { startsAt: 'a', endsAt: 'b' }).subscribe({ error: (e) => (status = e.status) });
    http.expectOne(`${api}/api/admin/routes/12/suspensions`).flush({ detail: 'solapa' }, { status: 409, statusText: 'Conflict' });
    expect(status).toBe(409);
  });

  it('create deja pasar el 400 por campo y el 404', () => {
    const statuses: number[] = [];
    service.create(1, { startsAt: 'a', endsAt: 'b' }).subscribe({ error: (e) => statuses.push(e.status) });
    http.expectOne(`${api}/api/admin/routes/1/suspensions`)
      .flush({ errors: [{ field: 'endsAt', message: 'x' }] }, { status: 400, statusText: 'Bad Request' });
    service.create(2, { startsAt: 'a', endsAt: 'b' }).subscribe({ error: (e) => statuses.push(e.status) });
    http.expectOne(`${api}/api/admin/routes/2/suspensions`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(statuses).toEqual([400, 404]);
  });

  it('lift hace DELETE y deja pasar 404 y 409', () => {
    let ok: Suspension | null = null;
    service.lift(7).subscribe((s) => (ok = s));
    const req = http.expectOne(`${api}/api/admin/suspensions/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ ...sus, state: 'LIFTED' });
    expect(ok!.state).toBe('LIFTED');

    const statuses: number[] = [];
    service.lift(8).subscribe({ error: (e) => statuses.push(e.status) });
    http.expectOne(`${api}/api/admin/suspensions/8`).flush({}, { status: 404, statusText: 'Not Found' });
    service.lift(9).subscribe({ error: (e) => statuses.push(e.status) });
    http.expectOne(`${api}/api/admin/suspensions/9`).flush({}, { status: 409, statusText: 'Conflict' });
    expect(statuses).toEqual([404, 409]);
  });

  it('NotificationService pide los avisos del usuario', () => {
    notifications.list().subscribe();
    const req = http.expectOne(`${api}/api/users/me/notifications`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
