import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  TotpConfirmRequest,
  TotpConfirmResponse,
  TotpEnrollResponse,
  RecoveryCodesResponse,
  TotpStatus,
} from '../models/totp.model';

/**
 * Cliente de la verificación en dos pasos (TOTP). Queda fuera de `/api/auth/` a propósito:
 * el interceptor adjunta el Bearer (el enrollmentToken en el enrolamiento forzado, el JWT
 * completo en el re-enrolamiento desde el perfil).
 */
@Injectable({ providedIn: 'root' })
export class TotpService {
  private readonly url = `${environment.apiUrl}/api/users/me/totp`;

  constructor(private http: HttpClient) {}

  getStatus(): Observable<TotpStatus> {
    return this.http.get<TotpStatus>(this.url);
  }

  enroll(): Observable<TotpEnrollResponse> {
    return this.http.post<TotpEnrollResponse>(`${this.url}/enroll`, {});
  }

  confirm(code: string): Observable<TotpConfirmResponse> {
    const body: TotpConfirmRequest = { code };
    return this.http.post<TotpConfirmResponse>(`${this.url}/confirm`, body);
  }

  /**
   * Reemplaza los 10 códigos de respaldo por un conjunto nuevo. Exige el token completo,
   * así que solo sirve desde el perfil, con sesión abierta — no es una vía de recuperación
   * para quien ya quedó fuera.
   */
  regenerateRecoveryCodes(): Observable<RecoveryCodesResponse> {
    return this.http.post<RecoveryCodesResponse>(`${this.url}/recovery-codes`, {});
  }
}
