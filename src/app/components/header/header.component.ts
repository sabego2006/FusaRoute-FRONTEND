import { Component, effect, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UnreadRepliesStore } from '../../core/unread-replies.store';

/**
 * Barra de navegación superior.
 *
 * - Siempre muestra el wordmark y el enlace al catálogo de rutas.
 * - Si el usuario NO está logueado: "Ingresar" y "Crear cuenta".
 * - Si el usuario SÍ está logueado: "Hola, {nombre}" · Comentarios · Mi perfil · Salir.
 * - Con rol ADMIN aparece además el enlace al Panel.
 *
 * El enlace de Comentarios lleva un globito con las respuestas nuevas desde el ingreso
 * anterior (RF-14, SCRUM-102). No es una notificación push —están fuera de alcance—,
 * sino un chequeo del backend al cargar la sesión.
 *
 * El enlace a comentarios solo aparece con sesión porque la pantalla la exige (RF-08):
 * cada comentario muestra el nombre de quien lo escribió, y sin cuenta no hay nombre.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="fr-header">
      <nav class="fr-header__nav">
        <a routerLink="/rutas" class="fr-header__brand">
          <span class="fr-wordmark">Fusa<b>Route</b></span>
        </a>

        <div class="fr-header__links">
          <a routerLink="/rutas" class="fr-header__link">Rutas</a>
          <a routerLink="/rutas/buscar" class="fr-header__link">Buscar ruta</a>

          @if (auth.isLoggedIn()) {
            <span class="fr-header__greeting">Hola, {{ auth.currentUser()?.name }}</span>
            <!-- SCRUM-102: el contador va DENTRO del enlace para que al pulsarlo se
                 vaya a ver justo lo que el aviso anuncia. aria-label incluye el numero
                 porque el globito solo se ve, no se lee. -->
            <a routerLink="/comentarios" class="fr-header__link fr-header__link--con-aviso"
               [attr.aria-label]="unread.count() > 0
                 ? 'Comentarios, ' + unread.count() + ' respuestas nuevas'
                 : 'Comentarios'">
              Comentarios
              @if (unread.count() > 0) {
                <span class="fr-aviso" aria-hidden="true">{{ unread.count() }}</span>
              }
            </a>
            @if (auth.currentUser()?.role === 'ADMIN') {
              <!-- Que este enlace solo se vea con rol ADMIN es comodidad, no
                   seguridad: el backend exige el rol en /api/admin/** y responde 403. -->
              <a routerLink="/admin/comentarios" class="fr-header__link">Panel</a>
            }
            <a routerLink="/perfil" class="fr-header__link">Mi perfil</a>
            <button class="fr-header__link fr-header__logout" (click)="logout()">Salir</button>
          } @else {
            <a routerLink="/login" class="fr-header__link">Ingresar</a>
            <a routerLink="/registro" class="fr-header__link fr-header__link--cta">Crear cuenta</a>
          }
        </div>
      </nav>
    </header>
  `,
  styles: [`
    .fr-header {
      border-bottom: var(--trazo-2) solid var(--borde);
      background: var(--superficie);
      padding: 0 var(--space-4);
    }
    .fr-header__nav {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      gap: var(--space-4);
    }
    .fr-header__brand { text-decoration: none; color: var(--tinta); }
    .fr-header__links {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
    .fr-header__link {
      text-decoration: none;
      color: var(--tinta);
      font-size: 0.9rem;
      font-weight: 500;
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
    }
    .fr-header__link:hover { background: var(--indigo-suave); }
    .fr-header__link--cta {
      background: var(--indigo);
      color: var(--sobre-indigo);
      padding: var(--space-1) var(--space-3);
    }
    .fr-header__link--cta:hover { background: var(--indigo-fondo); }
    .fr-header__greeting {
      font-size: 0.9rem;
      color: var(--tinta-suave);
    }
    .fr-header__link--con-aviso {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }
    .fr-aviso {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.25rem;
      height: 1.25rem;
      padding: 0 4px;
      border-radius: 999px;
      background: var(--indigo, #4F46E5);
      color: var(--sobre-indigo, #fff);
      font-size: 0.7rem;
      font-weight: 700;
      line-height: 1;
    }
    .fr-header__logout { color: var(--rojo-texto); }
    .fr-header__logout:hover { background: var(--rojo-suave); }
  `],
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly unread = inject(UnreadRepliesStore);
  private readonly router = inject(Router);

  constructor() {
    // Se pide el conteo cuando hay sesion y se apaga cuando no (SCRUM-102). Va en un
    // effect sobre isLoggedIn y no en ngOnInit porque tiene que dispararse en los dos
    // momentos en que puede haber sesion nueva: al iniciarla sin recargar la pagina
    // (el encabezado nunca se vuelve a montar, es parte del armazon de la app) y al
    // abrir la aplicacion con una sesion ya guardada.
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.unread.refresh();
      } else {
        this.unread.clear();
      }
    });
  }

  logout(): void {
    this.auth.logout();
    // navigate() rechaza si falla la carga diferida del chunk de destino (por ejemplo,
    // un despliegue nuevo invalidó el hash). Se registra en vez de dejar la promesa suelta.
    this.router
      .navigate(['/rutas'])
      .catch((err) => console.error('Navegación a /rutas fallida', err));
  }
}
