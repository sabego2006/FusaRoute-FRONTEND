import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetail } from '../../../models/auth.model';
import { parseLoginError } from '../../../lib/login-error';
import { TotpEnrollComponent } from '../../../components/totp-enroll/totp-enroll.component';

type LoginStep = 'credentials' | 'totp' | 'enroll';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TotpEnrollComponent],
  template: `
    <div class="fr-card" style="max-width: 400px; margin: 2rem auto;">
      <div style="margin-bottom: var(--space-6); display: flex; justify-content: center;">
        <span class="fr-wordmark">Fusa<b>Route</b></span>
      </div>

      @if (errorMessage()) {
        <div class="fr-alerta" role="alert" style="margin-bottom: var(--space-4);">
          <strong style="color: var(--rojo-texto);">¡Uy, parce!</strong> {{ errorMessage() }}
        </div>
      }

      @switch (step()) {
        @case ('credentials') {
          <div style="text-align: center; margin-bottom: var(--space-4);">
            <img src="assets/mascot/suta-wave.webp" alt="Indio Sutá saludando" class="fr-suta" style="margin: 0 auto var(--space-4);" width="96" height="96" loading="lazy" decoding="async">
            <h1 class="fr-titulo-1">¡Hágale, parcero!</h1>
            <p class="fr-texto-sm" style="margin-bottom: var(--space-6);">Entra a tu cuenta para guardar tu historial y tu destino favorito.</p>
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

            <button type="submit" class="fr-btn fr-btn-primario fr-btn-bloque" [disabled]="loginForm.invalid || loading()">
              {{ loading() ? 'Entrando...' : '¡Hágale!' }}
            </button>
          </form>

          <p class="fr-texto-sm" style="margin-top: var(--space-6); text-align: center;">
            ¿No tienes cuenta? <a class="fr-link" routerLink="/registro">Créala aquí, parce</a>
          </p>
          <p class="fr-texto-sm" style="margin-top: var(--space-2); text-align: center;">
            Puedes ver las rutas sin iniciar sesión. <a class="fr-link" routerLink="/rutas">Ver catálogo</a>
          </p>
        }
        @case ('totp') {
          <div style="text-align: center; margin-bottom: var(--space-4);">
            <img src="assets/mascot/suta-pointing.webp" alt="Indio Sutá señalando" class="fr-suta" style="margin: 0 auto var(--space-4);" width="96" height="96" loading="lazy" decoding="async">
            <h1 class="fr-titulo-1">Tranqui, un paso más</h1>
            <p class="fr-texto-sm" style="margin-bottom: var(--space-6);">
              {{ useBackupCode() ? 'Escribe uno de tus códigos de respaldo.' : 'Escribe el código de 6 dígitos de tu app autenticadora.' }}
            </p>
          </div>

          <form [formGroup]="totpForm" (ngSubmit)="onSubmitTotp()" style="display: flex; flex-direction: column; gap: var(--space-4);">
            <div class="fr-campo">
              <label class="fr-etiqueta" for="totp-code">{{ useBackupCode() ? 'Código de respaldo' : 'Código de verificación' }}</label>
              <input
                id="totp-code"
                class="fr-input"
                formControlName="code"
                type="text"
                [attr.inputmode]="useBackupCode() ? null : 'numeric'"
                [attr.maxlength]="useBackupCode() ? null : 6"
                autocomplete="one-time-code"
                [placeholder]="useBackupCode() ? 'Tu código de respaldo' : '123456'"
              >
            </div>

            <button type="submit" class="fr-btn fr-btn-primario fr-btn-bloque" [disabled]="totpForm.invalid || loading()">
              {{ loading() ? 'Verificando...' : '¡Listo!' }}
            </button>
          </form>

          <p class="fr-texto-sm" style="margin-top: var(--space-6); text-align: center;">
            <button type="button" class="fr-link" style="background: none; border: 0; padding: 0; cursor: pointer; font: inherit;" (click)="toggleBackupCode()">
              {{ useBackupCode() ? 'Usar el código de mi app' : 'Usar un código de respaldo' }}
            </button>
          </p>
          <p class="fr-texto-sm" style="margin-top: var(--space-2); text-align: center;">
            <button type="button" class="fr-link" style="background: none; border: 0; padding: 0; cursor: pointer; font: inherit;" (click)="backToCredentials()">
              Volver
            </button>
          </p>
        }
        @case ('enroll') {
          <div style="text-align: center; margin-bottom: var(--space-4);">
            <img src="assets/mascot/suta-de-pie.webp" alt="Indio Sutá de pie" class="fr-suta" style="margin: 0 auto var(--space-4);" width="96" height="96" loading="lazy" decoding="async">
            <h1 class="fr-titulo-1">Protege tu cuenta, parcero</h1>
            <p class="fr-texto-sm" style="margin-bottom: var(--space-6);">
              Para entrar a FusaRoute necesitas activar la verificación en dos pasos.
            </p>
          </div>
          <app-totp-enroll (enrolled)="onEnrolled()" (expired)="onEnrollmentExpired()" />
        }
      }
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
  readonly step = signal<LoginStep>('credentials');
  readonly useBackupCode = signal(false);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  totpForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
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
    this.attemptLogin();
  }

  onSubmitTotp(): void {
    if (this.totpForm.invalid) return;
    this.attemptLogin(this.totpForm.controls.code.value.trim());
  }

  toggleBackupCode(): void {
    this.useBackupCode.update((v) => !v);
    const code = this.totpForm.controls.code;
    code.setValidators(
      this.useBackupCode()
        ? [Validators.required]
        : [Validators.required, Validators.pattern(/^\d{6}$/)],
    );
    code.reset('');
    this.errorMessage.set(null);
  }

  backToCredentials(): void {
    this.resetTotpStep();
    this.step.set('credentials');
    this.errorMessage.set(null);
  }

  onEnrolled(): void {
    this.router
      .navigate(['/rutas/buscar'])
      .catch((err) => console.error('Navegación a /rutas/buscar fallida', err));
  }

  onEnrollmentExpired(): void {
    this.authService.clearEnrollmentToken();
    this.step.set('credentials');
    this.errorMessage.set('La configuración venció. Inicia sesión de nuevo para continuar.');
  }

  /** Envía correo + contraseña (y el código, si ya se pidió) al login. */
  private attemptLogin(totpCode?: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.value as { email: string; password: string };

    this.authService.login({ email, password, ...(totpCode ? { totpCode } : {}) }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router
          .navigate(['/rutas/buscar'])
          .catch((err) => console.error('Navegación a /rutas/buscar fallida', err));
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.handleLoginError(err);
      },
    });
  }

  private handleLoginError(err: HttpErrorResponse): void {
    // Bloqueo temporal (SCRUM-155): 423, distinto del 401 de credenciales
    // inválidas. El aviso debe ser explícito, no el genérico de abajo.
    if (err.status === 423) {
      this.resetTotpStep();
      this.step.set('credentials');
      this.errorMessage.set(
        'Tu cuenta está bloqueada temporalmente por varios intentos fallidos. Intenta de nuevo en unos minutos.',
      );
      return;
    }

    const mfa = err.status === 401 ? parseLoginError(err.error) : null;

    switch (mfa?.error) {
      case 'TOTP_ENROLLMENT_REQUIRED':
        this.authService.setEnrollmentToken(mfa.enrollmentToken);
        this.step.set('enroll');
        return;
      case 'TOTP_REQUIRED':
        this.step.set('totp');
        return;
      case 'INVALID_TOTP':
        this.step.set('totp');
        this.totpForm.controls.code.reset('');
        this.errorMessage.set('Código incorrecto. Inténtalo de nuevo.');
        return;
      default: {
        // Credenciales inválidas (o bloqueo temporal): se vuelve al paso 1.
        this.resetTotpStep();
        this.step.set('credentials');
        const body = err.error as ProblemDetail | undefined;
        this.errorMessage.set(body?.detail ?? 'Correo o contraseña incorrectos.');
      }
    }
  }

  private resetTotpStep(): void {
    this.useBackupCode.set(false);
    this.totpForm.controls.code.setValidators([Validators.required, Validators.pattern(/^\d{6}$/)]);
    this.totpForm.controls.code.reset('');
  }
}
