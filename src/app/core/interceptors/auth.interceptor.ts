import {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Interceptor funcional (Angular 21).
 *
 * - NO adjunta el token en peticiones a `/api/auth/**` (login y registro son
 *   públicos; enviar un Bearer viejo provoca un 401 del resource server que
 *   rebota al usuario al login innecesariamente).
 * - Un 401 en `/api/auth/login` NO redirige: es "credenciales incorrectas",
 *   no "sesión expirada".
 * - Cualquier otro 401 sí limpia la sesión y redirige al login.
 * - Durante el enrolamiento forzado de TOTP el usuario aún no tiene sesión: el `enrollmentToken`
 *   (solo en memoria) se usa como Bearer en lugar del token completo, y un 401 en ese momento
 *   no redirige; el componente de enrolamiento lo resuelve devolviendo al paso de credenciales.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // No adjuntar token en rutas de autenticación
  const isAuthRoute = req.url.includes('/api/auth/');
  const enrolling = auth.enrollmentToken() !== null;
  let authReq = req;
  if (!isAuthRoute) {
    const token = auth.enrollmentToken() ?? auth.token();
    if (token) {
      authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Un 401 en login/registro es "credenciales incorrectas", no redirigir
      if (error.status === 401 && !isAuthRoute && !enrolling) {
        auth.logout();
        router
          .navigate(['/login'])
          .catch((navErr) => console.error('Redirección al login fallida', navErr));
      }
      return throwError(() => error);
    }),
  );
};
