import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Barra de navegación superior.
 *
 * - Siempre muestra el wordmark y el enlace al catálogo de rutas.
 * - Si el usuario NO está logueado: "Ingresar" y "Crear cuenta".
 * - Si el usuario SÍ está logueado: "Hola, {nombre}" · Mi perfil · Salir.
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

          @if (auth.isLoggedIn()) {
            <span class="fr-header__greeting">Hola, {{ auth.currentUser()?.name }}</span>
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
    .fr-header__logout { color: var(--rojo-texto); }
    .fr-header__logout:hover { background: var(--rojo-suave); }
  `],
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/rutas']);
  }
}
