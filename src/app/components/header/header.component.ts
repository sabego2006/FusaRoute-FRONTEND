import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="header">
      <div class="logo">
        <a routerLink="/">🚌 FusaRoute</a>
      </div>

      <nav class="nav">
        <a routerLink="/routes" class="nav-link">Rutas</a>

        @if (authService.isLoggedIn()) {
          <span class="user-greeting">Hola, {{ authService.currentUser()?.name }}</span>
          <a routerLink="/profile" class="nav-link">Mi Perfil</a>
          <button (click)="logout()" class="logout-btn">Salir</button>
        } @else {
          <a routerLink="/login" class="nav-link">Ingresar</a>
          <a routerLink="/register" class="nav-link btn-primary">Crear cuenta</a>
        }
      </nav>
    </header>
  `,
  styles: [`
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: #0E2A47;
      color: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .logo a {
      font-size: 1.5rem;
      font-weight: bold;
      color: white;
      text-decoration: none;
    }
    .nav { display: flex; align-items: center; gap: 1.5rem; }
    .nav-link {
      color: rgba(255,255,255,0.8);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
    }
    .nav-link:hover { color: white; }
    .user-greeting { font-size: 0.9rem; color: #ddd; font-style: italic; }
    .logout-btn {
      background: none;
      border: 1px solid white;
      color: white;
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .logout-btn:hover { background: white; color: #0E2A47; }
    .btn-primary {
      background: #E8743B;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 6px;
    }
  `]
})
export class HeaderComponent {
  public authService = inject(AuthService);

  logout() {
    this.authService.logout();
    // Redirección al login se maneja mediante el interceptor o el guard
  }
}
`
}
