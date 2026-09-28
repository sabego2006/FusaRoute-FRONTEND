import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, tap } from 'rxjs';
import { AuthResponse, LoginCredentials, UserProfile } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly authUrl = `${environment.apiUrl}/api/auth`;

  // Signals para el estado de autenticación
  currentUser = signal<UserProfile | null>(null);
  isLoggedIn = computed(() => !!this.currentUser());

  constructor(private http: HttpClient) {}

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authUrl}/login`, credentials).pipe(
      tap(res => {
        if (res && res.token) {
          localStorage.setItem('token', res.token);
          // Nota: El perfil se carga en el componente de inicio o mediante un servicio de usuario
        }
      })
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.authUrl}/register`, userData);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  logout(): void {
    localStorage.removeItem('token');
    this.currentUser.set(null);
  }

  // Método para actualizar el estado del usuario desde la API
  setUserProfile(profile: UserProfile): void {
    this.currentUser.set(profile);
  }
}
