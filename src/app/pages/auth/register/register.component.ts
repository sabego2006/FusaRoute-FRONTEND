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
    <div class="fr-pagina fr-fondo-puntos">
      <div class="fr-franja-arhuaca" aria-hidden="true"></div>
    <div class="fr-card fr-card--paramo" style="max-width: 400px; margin: 2rem auto; position: relative; padding-bottom: 36px;">
      <div style="margin-bottom: var(--space-4); display: flex; flex-direction: column; align-items: center; gap: var(--space-3);">
        <span class="fr-wordmark">Fusa<b>Route</b></span>
        <!-- T05 (R2): la placa de la buseta como eyebrow de la pantalla. -->
        <p class="fr-chip-letrero">Busetas de Fusa · Sumapaz</p>
      </div>
      <div class="fr-greca fr-greca--fina fr-greca--paramo" aria-hidden="true" style="margin-bottom: var(--space-4);"></div>

      <div style="text-align: center; margin-bottom: var(--space-4);">
        <img src="assets/mascot/suta-wave.webp" alt="Indio Sutá saludando" class="fr-suta" style="margin: 0 auto var(--space-4);" width="96" height="96" loading="lazy" decoding="async">
        <h1 class="fr-titulo-1 fr-titulo-cartel"><span class="fr-cartel-2">¡Hágale, parcero!</span></h1>
        <p class="fr-texto-sm" style="margin-bottom: var(--space-6);">Únete a la comunidad y guarda tus rutas favoritas.</p>
      </div>

      @if (generalError()) {
        <!-- T05 (R4): Sutá acompaña el error. -->
        <div class="fr-suta-estado fr-suta-estado--error" role="alert" style="margin-bottom: var(--space-4);">
          <img src="assets/mascot/suta-de-pie.webp" alt="" aria-hidden="true" class="fr-suta fr-suta-sm" width="48" height="48" loading="lazy" decoding="async">
          <div>
            <p><strong style="color: var(--rojo-texto);">Error:</strong> {{ generalError() }}</p>
          </div>
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
          {{ loading() ? 'Registrando...' : '¡Hágale!' }}
        </button>
      </form>

      <p class="fr-texto-sm" style="margin-top: var(--space-6); text-align: center;">
        ¿Ya tienes cuenta? <a class="fr-link" routerLink="/login">Inicia sesión aquí</a>
      </p>
    
          <img class="fr-sticker fr-pegar" style="--r:7deg;--d:.2s;right:-8px;top:-42px;width:86px" src="assets/stickers/policarpa-salavarrieta.webp" width="86" height="118" alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low">
          <span class="fr-bocadillo fr-bocadillo--der fr-pegar" style="--r:-4deg;--d:.2s;right:84px;top:-22px" aria-hidden="true">¡Regístrese, pues!</span>
          <img class="fr-sticker fr-pegar" style="--r:5deg;--d:.4s;right:-6px;bottom:-26px;width:84px" src="assets/stickers/gabo-garcia-marquez.webp" width="84" height="76" alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low">
          <span class="fr-bocadillo fr-bocadillo--der fr-pegar" style="--r:-3deg;--d:.4s;right:90px;bottom:-14px" aria-hidden="true">Cien años de ruta</span>
          <img class="fr-sticker fr-pegar" style="--r:16deg;--d:.5s;right:6px;top:46%;width:44px" src="assets/stickers/mariposa-amarilla.svg" width="44" height="44" alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low">
          <img class="fr-sticker fr-pegar" style="--r:-18deg;--d:.6s;left:-8px;top:62%;width:38px" src="assets/stickers/mariposa-amarilla.svg" width="38" height="38" alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low">
      </div>
      <div class="fr-franja-arhuaca fr-franja-arhuaca--inversa" aria-hidden="true"></div>
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
        this.router
          .navigate(['/login'], {
            queryParams: { email: this.registerForm.value.email },
          })
          .catch((err) => console.error('Navegación al login fallida', err));
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
