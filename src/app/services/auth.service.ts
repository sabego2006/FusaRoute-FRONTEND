import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, tap } from 'rxjs';
import {
  LoginCredentials,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  UserSummary,
} from '../models/auth.model';

/**
 * Servicio de autenticación. Guarda el token, el usuario y la fecha de expiración.
 *
 * `isLoggedIn` es un computed signal que revisa tanto la existencia del token como
 * su vencimiento (RNF-04: el JWT dura una semana; vencido, se redirige al login).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authUrl = `${environment.apiUrl}/api/auth`;

  // Estado reactivo: signals
  readonly currentUser = signal<UserSummary | null>(this.loadUser());
  readonly token = signal<string | null>(this.loadToken());
  private readonly expiresAt = signal<string | null>(this.loadExpiry());

  /**
   * Token de vida corta que solo sirve para enrolar/confirmar TOTP. Vive únicamente en memoria:
   * nunca se escribe en localStorage, así que recargar la página lo descarta.
   */
  readonly enrollmentToken = signal<string | null>(null);

  /**
   * Dispositivo de confianza del segundo factor (decisión del 17-nov-2026, SCRUM-196): si
   * el backend lo reconoce vigente para una cuenta USER, el login no vuelve a
   * pedir el código TOTP. A propósito en localStorage, igual que `token`: es
   * el mismo origen (Vercel) y el mismo riesgo ya aceptado por el JWT de
   * acceso, y evita abrir una cookie entre sitios (Vercel↔Render) que las
   * políticas de cookies de terceros de los navegadores ya bloquean por
   * defecto. `logout()` NO lo borra (el usuario espera no repetir el TOTP).
   */
  private readonly trustToken = signal<string | null>(this.loadTrustToken());

  readonly isLoggedIn = computed(() => {
    const t = this.token();
    const exp = this.expiresAt();
    if (!t || !exp) return false;
    return new Date(exp).getTime() > Date.now();
  });

  constructor(private http: HttpClient) {}

  /**
   * El dispositivo de confianza guardado (si hay uno) se adjunta siempre,
   * aunque la cuenta sea ADMIN: el backend decide por el rol, nunca el
   * cliente (decisión del 17-nov-2026, SCRUM-196).
   */
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    const body: LoginCredentials = { ...credentials, trustToken: this.trustToken() ?? undefined };
    return this.http
      .post<LoginResponse>(`${this.authUrl}/login`, body)
      .pipe(tap((res) => this.applySession(res)));
  }

  setEnrollmentToken(token: string): void {
    this.enrollmentToken.set(token);
  }

  clearEnrollmentToken(): void {
    this.enrollmentToken.set(null);
  }

  /** Guarda la sesión completa (login o confirmación de TOTP) y descarta el enrollmentToken. */
  applySession(res: LoginResponse): void {
    try {
      localStorage.setItem('token', res.token);
      localStorage.setItem('expiresAt', res.expiresAt);
      localStorage.setItem('user', JSON.stringify(res.user));
    } catch { /* entorno sin localStorage (test, incógnito) */ }
    this.token.set(res.token);
    this.expiresAt.set(res.expiresAt);
    this.currentUser.set(res.user);
    this.enrollmentToken.set(null);
    // Ausente = no se renovó (se saltó el TOTP, fue un código de respaldo, o es
    // ADMIN): se conserva el que ya hubiera, nunca se borra por esto.
    if (res.trustToken) {
      try { localStorage.setItem('trustToken', res.trustToken); } catch { /* no-op */ }
      this.trustToken.set(res.trustToken);
    }
  }

  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(
      `${this.authUrl}/register`,
      data,
    );
  }

  logout(): void {
    this.clearSession();
  }

  /** Actualiza el nombre del usuario en el signal (tras un PUT al perfil). */
  patchUserName(name: string): void {
    const u = this.currentUser();
    if (u) {
      this.currentUser.set({ ...u, name });
      try { localStorage.setItem('user', JSON.stringify(this.currentUser())); } catch { /* no-op */ }
    }
  }

  // --- Persistencia en localStorage ---

  /**
   * Cierra la sesión. NO toca `trustToken` a propósito (decisión del
   * 17-nov-2026, SCRUM-196): el usuario espera no repetir el TOTP en 15 días aunque
   * cierre sesión entre medias, en el mismo dispositivo.
   */
  private clearSession(): void {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('expiresAt');
      localStorage.removeItem('user');
    } catch { /* no-op */ }
    this.token.set(null);
    this.expiresAt.set(null);
    this.currentUser.set(null);
    this.enrollmentToken.set(null);
  }

  private loadToken(): string | null {
    try { return localStorage.getItem('token'); } catch { return null; }
  }

  private loadTrustToken(): string | null {
    try { return localStorage.getItem('trustToken'); } catch { return null; }
  }

  private loadExpiry(): string | null {
    try { return localStorage.getItem('expiresAt'); } catch { return null; }
  }

  private loadUser(): UserSummary | null {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) as UserSummary : null;
    } catch { return null; }
  }
}
