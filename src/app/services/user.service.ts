import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { UserProfile, UpdateProfileRequest, ChangePasswordRequest } from '../models/auth.model';
import { FavoriteDestination } from '../models/favorite.model';

/** Cliente HTTP para el perfil del usuario autenticado (RF-03) y su destino favorito (RF-10). */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly url = `${environment.apiUrl}/api/users/me`;

  constructor(private http: HttpClient) {}

  /**
   * Destino favorito del usuario, con el aviso de tranco ya calculado (RF-10).
   *
   * El backend responde **204 sin cuerpo** cuando el usuario no tiene favorito, que
   * es el estado normal de una cuenta nueva y no un error. Angular entrega `null` en
   * ese caso, así que quien llama distingue "no tiene" de "falló" sin mirar códigos.
   */
  getFavoriteDestination(): Observable<FavoriteDestination | null> {
    return this.http.get<FavoriteDestination | null>(`${this.url}/favorite-destination`);
  }

  /** Marca el destino como favorito, reemplazando el anterior: solo hay uno a la vez. */
  setFavoriteDestination(destination: string): Observable<FavoriteDestination> {
    return this.http.put<FavoriteDestination>(`${this.url}/favorite-destination`, { destination });
  }

  /** Deja al usuario sin favorito. Es idempotente. */
  clearFavoriteDestination(): Observable<void> {
    return this.http.delete<void>(`${this.url}/favorite-destination`);
  }

  getMe(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.url);
  }

  updateMe(data: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.url, data);
  }

  changePassword(data: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(`${this.url}/password`, data);
  }
}
