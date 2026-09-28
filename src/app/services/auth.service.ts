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

  readonly isLoggedIn = computed(() => {
    const t = this.token();
    const exp = this.expiresAt();
    if (!t || !exp) return false;
    return new Date(exp).getTime() > Date.now();
  });

  constructor(private http: HttpClient) {}

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.authUrl}/login`, credentials)
      .pipe(tap((res) => this.saveSession(res)));
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

  private saveSession(res: LoginResponse): void {
    try {
      localStorage.setItem('token', res.token);
      localStorage.setItem('expiresAt', res.expiresAt);
      localStorage.setItem('user', JSON.stringify(res.user));
    } catch { /* entorno sin localStorage (test, incógnito) */ }
    this.token.set(res.token);
    this.expiresAt.set(res.expiresAt);
    this.currentUser.set(res.user);
  }

  private clearSession(): void {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('expiresAt');
      localStorage.removeItem('user');
    } catch { /* no-op */ }
    this.token.set(null);
    this.expiresAt.set(null);
    this.currentUser.set(null);
  }

  private loadToken(): string | null {
    try { return localStorage.getItem('token'); } catch { return null; }
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
