import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserService } from './user.service';
import { environment } from '../../environments/environment';

describe('UserService', () => {
  let service: UserService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getMe pide GET /api/users/me', () => {
    const mockProfile = { id: 1, name: 'Gladys', email: 'g@f.co', phone: '3101234567' };

    let result: unknown;
    service.getMe().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/users/me`);
    expect(req.request.method).toBe('GET');
    req.flush(mockProfile);

    expect(result).toEqual(mockProfile);
  });

  it('updateMe envía PUT /api/users/me con los datos', () => {
    const update = { name: 'Gladys Ruiz', email: 'g@f.co', phone: null };

    service.updateMe(update).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/api/users/me`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(update);
    req.flush({ id: 1, ...update });
  });

  it('changePassword envía PUT /api/users/me/password', () => {
    const data = { currentPassword: 'Old1234', newPassword: 'New5678' };

    service.changePassword(data).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/api/users/me/password`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(data);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('propaga error 400 del backend', () => {
    let errorStatus: number | undefined;
    service.changePassword({ currentPassword: 'bad', newPassword: 'x' }).subscribe({
      error: (e) => (errorStatus = e.status),
    });

    http.expectOne(`${environment.apiUrl}/api/users/me/password`).flush(
      { type: 'about:blank', title: 'Bad Request', status: 400, detail: 'Contraseña actual incorrecta' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(errorStatus).toBe(400);
  });
});
