import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Barra de navegación inferior, solo en pantalla angosta.
 *
 * Existe porque la app se consulta de pie en la calle y con una mano: los
 * destinos que más se usan quedan al alcance del pulgar, no arriba. En
 * escritorio se esconde y navega el header, que ahí sí tiene espacio.
 *
 * Son tres destinos porque son las tres pantallas que existen. "Favoritos"
 * está planeado para Sprint 6-9 y no se pone hasta que haya a dónde ir: un tab
 * que no lleva a ninguna parte es peor que un tab que falta.
 *
 * Los iconos van incrustados en la plantilla y no como `<img src>` porque usan
 * `stroke="currentColor"`: dentro de un `<img>` el SVG se carga como documento
 * aparte, sin heredar el color del contenedor, y el estado activo no podría
 * cambiarlo.
 */
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="fr-nav" aria-label="Navegación principal">
      <a
        routerLink="/rutas"
        routerLinkActive="is-activa"
        [routerLinkActiveOptions]="{ exact: true }"
        class="fr-nav__item"
      >
        <svg class="fr-nav__icono" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span class="fr-nav__texto">Rutas</span>
      </a>

      <a routerLink="/rutas/buscar" routerLinkActive="is-activa" class="fr-nav__item">
        <svg class="fr-nav__icono" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span class="fr-nav__texto">Buscar</span>
      </a>

      <a
        [routerLink]="auth.isLoggedIn() ? '/perfil' : '/login'"
        routerLinkActive="is-activa"
        class="fr-nav__item"
      >
        <svg class="fr-nav__icono" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span class="fr-nav__texto">{{ auth.isLoggedIn() ? 'Perfil' : 'Ingresar' }}</span>
      </a>
    </nav>
  `,
  styles: [`
    .fr-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 20;
      display: flex;
      align-items: stretch;
      height: calc(var(--fr-nav-alto) + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--tinta);
      border-top: var(--trazo-2) solid var(--borde);
    }

    .fr-nav__item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      /* 44px es el mínimo táctil; el alto de la barra ya lo supera. */
      min-height: 44px;
      text-decoration: none;
      color: var(--superficie);
      /* Sin color de fondo en reposo: el contraste lo da el texto sobre tinta. */
      opacity: .6;
      transition: opacity .2s ease, color .2s ease;
    }

    .fr-nav__icono {
      width: 24px;
      height: 24px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .fr-nav__texto {
      font: 600 11px/1 var(--font-sans);
      letter-spacing: .02em;
    }

    .fr-nav__item.is-activa {
      opacity: 1;
      color: var(--lima);
    }

    .fr-nav__item:focus-visible {
      outline: 3px solid var(--lima);
      outline-offset: -3px;
    }

    /*
     * En escritorio navega el header. Mantener las dos barras duplicaría la
     * navegación y en pantalla ancha una barra de tabs abajo no corresponde.
     */
    @media (min-width: 760px) {
      .fr-nav { display: none; }
    }
  `],
})
export class BottomNavComponent {
  protected readonly auth = inject(AuthService);
}
