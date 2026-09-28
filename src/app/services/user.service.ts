import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { UserProfile, UpdateProfileRequest, ChangePasswordRequest } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly baseUrl = `${environment.apiUrl}/api/users/me`;

  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.baseUrl);
  }

  updateProfile(request: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.baseUrl, request);
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/password`, request);
  }
}
