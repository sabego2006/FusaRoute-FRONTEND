import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../components/toast/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { FieldViolation, ProblemDetail } from '../../../models/auth.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="fr-card" style="max-width: 400px; margin: 2rem auto;">
      <div style="margin-bottom: var(--space-6); display: flex; justify-content: center;">
        <span class="fr-wordmark">Fusa<b>Route</b></span>
      </div>

      <h1 class="fr-titulo-1" style="text-align: center; margin-bottom: var(--space-4);">Crear Cuenta</h1>
      <p class="fr-texto-sm" style="text-align: center; margin-bottom: var(--space-6);">Únete a la comunidad y guarda tus rutas favoritas.</p>

      @if (generalError()) {
        <div class="fr-alerta" role="alert" style="margin-bottom: var(--space-4);">
          <strong>Error:</strong> {{ generalError() }}
        </div>
      }

      <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div class="fr-campo">
          <label class="fr-etiqueta" for="name">Nombre</label>
          <input id="name" class="fr-input" formControlName="name" type="text" placeholder="Tu nombre completo">
          @if (fieldError('name')) {
            <p class="fr-ayuda-error">{{ fieldError('name') }}</p>
          }
        </div>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="email">Correo Electrónico</label>
          <input id="email" class="fr-input" formControlName="email" type="email" placeholder="ejemplo@correo.com">
          @if (fieldError('email')) {
            <p class="fr-ayuda-error">{{ fieldError('email') }}</p>
          }
        </div>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="password">Contraseña</label>
          <input id="password" class="fr-input" formControlName="password" type="password" placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número">
          @if (fieldError('password')) {
            <p class="fr-ayuda-error">{{ fieldError('password') }}</p>
          }
        </div>

        <button type="submit" class="fr-btn fr-btn-primario fr-btn-bloque" [disabled]="registerForm.invalid || loading()">
          {{ loading() ? 'Registrando...' : 'Registrarse' }}
        </button>
      </form>

      <p class="fr-texto-sm" style="margin-top: var(--space-6); text-align: center;">
        ¿Ya tienes cuenta? <a class="fr-link" routerLink="/login">Inicia sesión aquí</a>
      </p>
    </div>
  `,
  styles: [],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly generalError = signal<string | null>(null);
  private readonly fieldErrors = signal<FieldViolation[]>([]);

  registerForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Z])(?=.*\d)/)],],
  });

  /** Devuelve el error del backend para un campo, si existe. */
  fieldError(field: string): string | null {
    return this.fieldErrors().find((v) => v.field === field)?.message ?? null;
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;
    this.loading.set(true);
    this.generalError.set(null);
    this.fieldErrors.set([]);

    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.show('Cuenta creada con éxito', 'success');
        // Paso al login con el correo precargado
        this.router.navigate(['/login'], {
          queryParams: { email: this.registerForm.value.email },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error as ProblemDetail | undefined;
        if (body?.errors?.length) {
          this.fieldErrors.set(body.errors);
        }
        if (err.status === 409) {
          this.generalError.set('Este correo electrónico ya se encuentra registrado.');
        } else if (body?.detail) {
          this.generalError.set(body.detail);
        } else {
          this.generalError.set('Ocurrió un error al registrar la cuenta.');
        }
      },
    });
  }
}
