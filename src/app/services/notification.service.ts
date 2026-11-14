import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserNotification } from '../models/notification.model';

/** Cliente HTTP de los avisos in-app del usuario con sesión (RF-12). */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/users/me/notifications`;

  /** Avisos de suspensiones vigentes que le importan al usuario. `[]` si ninguno aplica. */
  list(): Observable<UserNotification[]> {
    return this.http.get<UserNotification[]>(this.url);
  }
}
