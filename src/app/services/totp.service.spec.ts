import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TotpService } from './totp.service';
import { environment } from '../../environments/environment';

describe('TotpService', () => {
  const base = `${environment.apiUrl}/api/users/me/totp`;
  let service: TotpService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TotpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getStatus hace GET /totp', () => {
    let enabled: boolean | undefined;
    service.getStatus().subscribe((s) => (enabled = s.enabled));

    const req = http.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush({ enabled: true });

    expect(enabled).toBe(true);
  });

  it('enroll hace POST /totp/enroll', () => {
    service.enroll().subscribe();

    const req = http.expectOne(`${base}/enroll`);
    expect(req.request.method).toBe('POST');
    req.flush({ secret: 'S', otpauthUri: 'otpauth://totp/x', qrPngBase64: 'AAAA' });
  });

  it('confirm hace POST /totp/confirm con el código', () => {
    service.confirm('123456').subscribe();

    const req = http.expectOne(`${base}/confirm`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush({});
  });
});
