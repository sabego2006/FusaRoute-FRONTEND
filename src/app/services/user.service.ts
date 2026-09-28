import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { UserProfile, UpdateProfileRequest, ChangePasswordRequest } from '../models/auth.model';

/** Cliente HTTP para el perfil del usuario autenticado (RF-03). */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly url = `${environment.apiUrl}/api/users/me`;

  constructor(private http: HttpClient) {}

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
