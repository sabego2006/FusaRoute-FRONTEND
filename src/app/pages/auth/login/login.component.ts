import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="fr-card" style="max-width: 400px; margin: 2rem auto;">
      <div class="fr-barra" style="margin-bottom: var(--space-6); display: flex; justify-content: center;">
        <span class="fr-wordmark">Fusa<b>Route</b></span>
      </div>

      <h1 class="fr-titulo-1" style="text-align: center; margin-bottom: var(--space-4);">Entra a tu cuenta</h1>
      <p class="fr-texto-sm" style="text-align: center; margin-bottom: var(--space-6);">Guarda tu historial y tu destino favorito.</p>

      <div *ngIf="errorMessage" class="fr-alerta" role="alert" style="margin-bottom: var(--space-4);">
        <strong>Error:</strong> {{ errorMessage }}
      </div>

      <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div class="fr-campo">
          <label class="fr-etiqueta" for="email">Correo</label>
          <input id="email" class="fr-input" formControlName="email" type="email" placeholder="usuario@correo.com">
        </div>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="password">Contraseña</label>
          <input id="password" class="fr-input" formControlName="password" type="password" placeholder="Tu contraseña">
        </div>

        <button type="submit" class="fr-btn fr-btn-primario fr-btn-bloque" [disabled]="loginForm.invalid">
          Entrar
        </button>
      </form>

      <p class="fr-texto-sm" style="margin-top: var(--space-6); text-align: center;">
        ¿No tienes cuenta? <a class="fr-link" routerLink="/registro">Créala aquí</a>
      </p>
      <p class="fr-texto-sm" style="margin-top: var(--space-2); text-align: center;">
        Puedes ver las rutas sin iniciar sesión. <a class="fr-link" routerLink="/rutas">Ver catálogo</a>
      </p>
    </div>
  `,
  styles: [] // Estilos movidos a src/styles.css mediante clases .fr-
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.errorMessage = '';
      this.authService.login(this.loginForm.value).subscribe({
        next: () => {
          this.router.navigate(['/rutas']);
        },
        error: (err: unknown) => {
          this.errorMessage = 'Correo o contraseña incorrectos.';
        }
      });
    }
  }
}
