import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Barra de navegación superior.
 *
 * - Siempre muestra el wordmark y el enlace al catálogo de rutas.
 * - Si el usuario NO está logueado: "Ingresar" y "Crear cuenta".
 * - Si el usuario SÍ está logueado: "Hola, {nombre}" · Mis búsquedas · Comentarios ·
 *   Mi perfil · Salir.
 *
 * "Mis búsquedas" (RF-07) solo aparece con sesión porque el historial vive en la cuenta.
 * Ocultarlo es cortesía visual: la ruta lleva su `authGuard` y el endpoint exige token.
 * Igual con comentarios (RF-08): cada comentario muestra el nombre de quien lo escribió,
 * y sin cuenta no hay nombre.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="fr-header">
      <nav class="fr-header__nav">
        <a routerLink="/rutas" class="fr-header__brand">
          <div class="fr-logo-container">
            <img src="assets/logo.svg" alt="FusaRoute Logo" class="fr-logo-icon">
          </div>
          <span class="fr-wordmark">Fusa<b>Route</b></span>
        </a>

        <div class="fr-header__links">
          <a routerLink="/rutas" class="fr-header__link fr-header__link--nav">Rutas</a>
          <a routerLink="/rutas/buscar" class="fr-header__link fr-header__link--nav">Busque su ruta, parce</a>

          @if (auth.isLoggedIn()) {
            <span class="fr-header__greeting">Hola, {{ auth.currentUser()?.name }}</span>
            <a routerLink="/historial" class="fr-header__link">Mis búsquedas</a>
            <a routerLink="/comentarios" class="fr-header__link">Comentarios</a>
            <a routerLink="/perfil" class="fr-header__link fr-header__link--nav">Mi perfil</a>
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
    /*
     * Flex explícito: el isotipo va rotado -3deg y, en flujo inline, la
     * rotación lo desalinea respecto a la línea base del wordmark.
     */
    .fr-header__brand {
      text-decoration: none;
      color: var(--tinta);
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex: none;
    }
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
    .fr-header__logout { color: var(--rojo-texto); }
    .fr-header__logout:hover { background: var(--rojo-suave); }

    /*
     * En celular estos tres destinos ya están en la barra inferior, al alcance
     * del pulgar. Repetirlos arriba solo apretaba el header hasta hacerlo
     * envolver en dos líneas. Las acciones de sesión sí se quedan: no están
     * abajo.
     */
    @media (max-width: 759px) {
      .fr-header__link--nav { display: none; }
      .fr-header__greeting { display: none; }
    }
  `],
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    // navigate() rechaza si falla la carga diferida del chunk de destino (por ejemplo,
    // un despliegue nuevo invalidó el hash). Se registra en vez de dejar la promesa suelta.
    this.router
      .navigate(['/rutas'])
      .catch((err) => console.error('Navegación a /rutas fallida', err));
  }
}
