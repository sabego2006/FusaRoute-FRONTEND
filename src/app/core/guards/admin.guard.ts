import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../components/toast/toast.service';

/**
 * Guard de rol para el panel de administrador (RF-14, SCRUM-103 · RF-11, SCRUM-112).
 *
 * **Esto no es seguridad, es cortesía visual.** Lo único que hace es evitar que un
 * usuario normal aterrice en una pantalla que no le va a funcionar: cualquiera puede
 * editar el `localStorage` de su navegador y poner `role: 'ADMIN'`, y el guard lo
 * dejaría pasar. Lo que de verdad protege los datos es Spring Security en el backend,
 * que exige rol ADMIN sobre todo `/api/admin/**` (SCRUM-104) y responde 403 — así que
 * esa pantalla, abierta a la fuerza, no mostraría ni un comentario.
 *
 * El rol sale del usuario de la sesión, que a su vez vino del `LoginResponse` del
 * backend. Un token viejo emitido antes de subir la cuenta a ADMIN sigue diciendo
 * `USER`; hay que reloguear, y eso es intencional (el rol viaja dentro del JWT).
 *
 * Los dos destinos del rechazo son distintos a propósito:
 * - sin sesión → al login, porque iniciar sesión puede resolverlo;
 * - con sesión pero sin rol → al buscador (la pantalla de inicio de la app), porque
 *   volver a iniciar sesión no va a cambiar nada y mandarlo al login sería un bucle
 *   que no explica nada. Va con un aviso breve para que la redirección no parezca un
 *   fallo del enlace.
 *
 * El guard corre antes de que el router cargue el componente, así que el rechazo no
 * llega a pintar nada de administración.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  if (auth.currentUser()?.role !== 'ADMIN') {
    toast.show('Esa sección es solo para administradores.', 'info');
    return router.createUrlTree(['/rutas/buscar']);
  }
  return true;
};
