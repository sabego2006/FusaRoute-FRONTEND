import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetail } from '../../../models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="fr-card" style="max-width: 400px; margin: 2rem auto;">
      <div style="margin-bottom: var(--space-6); display: flex; justify-content: center;">
        <span class="fr-wordmark">Fusa<b>Route</b></span>
      </div>

      <h1 class="fr-titulo-1" style="text-align: center; margin-bottom: var(--space-4);">Entra a tu cuenta</h1>
      <p class="fr-texto-sm" style="text-align: center; margin-bottom: var(--space-6);">Guarda tu historial y tu destino favorito.</p>

      @if (errorMessage()) {
        <div class="fr-alerta" role="alert" style="margin-bottom: var(--space-4);">
          <strong>Error:</strong> {{ errorMessage() }}
        </div>
      }

      <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div class="fr-campo">
          <label class="fr-etiqueta" for="email">Correo</label>
          <input id="email" class="fr-input" formControlName="email" type="email" placeholder="usuario@correo.com">
        </div>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="password">Contraseña</label>
          <input id="password" class="fr-input" formControlName="password" type="password" placeholder="Tu contraseña">
        </div>

        <button type="submit" class="fr-btn fr-btn-primario fr-btn-bloque" [disabled]="loginForm.invalid || loading()">
          {{ loading() ? 'Entrando...' : 'Entrar' }}
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
  styles: [],
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly errorMessage = signal<string | null>(null);
  readonly loading = signal(false);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  ngOnInit(): void {
    // Si viene del registro, precargar el correo
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.loginForm.patchValue({ email });
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/rutas']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error as ProblemDetail | undefined;
        this.errorMessage.set(body?.detail ?? 'Correo o contraseña incorrectos.');
      },
    });
  }
}
