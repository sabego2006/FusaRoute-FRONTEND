import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { TotpService } from '../../services/totp.service';
import { ToastService } from '../../components/toast/toast.service';
import { TotpEnrollComponent } from '../../components/totp-enroll/totp-enroll.component';
import { UserProfile, FieldViolation, ProblemDetail } from '../../models/auth.model';
import { HttpErrorResponse } from '@angular/common/http';
import { copyText } from '../../lib/clipboard';
import { downloadText } from '../../lib/download';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, TotpEnrollComponent],
  template: `
    <div class="fr-pagina fr-fondo-puntos fr-pagina--personajes">
      <div class="fr-franja-arhuaca" aria-hidden="true"></div>
    <div class="fr-card fr-card--paramo" style="max-width: 480px; margin: 2rem auto;">
      <!-- T05 (R2): la placa de la buseta como eyebrow de la pantalla. -->
      <p class="fr-chip-letrero" style="margin-bottom: var(--space-3);">Tu cuenta · FusaRoute</p>
      <h1 class="fr-titulo-1 fr-titulo-cartel" style="margin-bottom: var(--space-6);"><span class="fr-cartel-2">Mi perfil</span></h1>

      <!-- Datos personales -->
      <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div class="fr-campo">
          <label class="fr-etiqueta" for="name">Nombre</label>
          <input id="name" class="fr-input" formControlName="name" type="text">
          @if (fieldError('name')) {
            <p class="fr-ayuda-error">{{ fieldError('name') }}</p>
          }
        </div>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="email">Correo</label>
          <input id="email" class="fr-input" formControlName="email" type="email">
          @if (fieldError('email')) {
            <p class="fr-ayuda-error">{{ fieldError('email') }}</p>
          }
        </div>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="phone">Teléfono <span style="color:var(--tinta-suave)">(opcional)</span></label>
          <input id="phone" class="fr-input" formControlName="phone" type="tel" placeholder="Ej. 3101234567">
          @if (fieldError('phone')) {
            <p class="fr-ayuda-error">{{ fieldError('phone') }}</p>
          }
        </div>

        @if (profileError()) {
          <p class="fr-alerta">{{ profileError() }}</p>
        }

        <button type="submit" class="fr-btn fr-btn-primario fr-btn-bloque" [disabled]="savingProfile()">
          {{ savingProfile() ? 'Guardando...' : 'Guardar cambios' }}
        </button>
      </form>

      <!-- Cambiar contraseña. T05 (R1): la greca separa las secciones en vez del <hr>. -->
      <div class="fr-greca fr-greca--fina fr-greca--paramo" aria-hidden="true" style="margin: var(--space-8) 0;"></div>
      <h2 class="fr-titulo-2" style="margin-bottom: var(--space-4);">Cambiar contraseña</h2>

      <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div class="fr-campo">
          <label class="fr-etiqueta" for="currentPassword">Contraseña actual</label>
          <input id="currentPassword" class="fr-input" formControlName="currentPassword" type="password">
          @if (fieldError('currentPassword') || fieldError('password')) {
            <p class="fr-ayuda-error">{{ fieldError('currentPassword') || fieldError('password') }}</p>
          }
        </div>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="newPassword">Nueva contraseña</label>
          <input id="newPassword" class="fr-input" formControlName="newPassword" type="password"
                 placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número">
          @if (fieldError('newPassword')) {
            <p class="fr-ayuda-error">{{ fieldError('newPassword') }}</p>
          }
        </div>

        @if (passwordError()) {
          <p class="fr-alerta">{{ passwordError() }}</p>
        }

        <button type="submit" class="fr-btn fr-btn-bloque" [disabled]="savingPassword()"
                style="background: var(--superficie); border: var(--trazo-2) solid var(--borde);">
          {{ savingPassword() ? 'Cambiando...' : 'Cambiar contraseña' }}
        </button>
      </form>

      <!-- Seguridad: verificación en dos pasos (obligatoria, no se puede desactivar) -->
      <div class="fr-greca fr-greca--fina fr-greca--paramo" aria-hidden="true" style="margin: var(--space-8) 0;"></div>
      <h2 class="fr-titulo-2" style="margin-bottom: var(--space-4);">Verificación en dos pasos</h2>

      @if (reenrolling()) {
        <app-totp-enroll (enrolled)="onReenrolled()" />
        <button type="button" class="fr-btn fr-btn-bloque" style="margin-top: var(--space-4);" (click)="reenrolling.set(false)">
          Cancelar
        </button>
      } @else {
        @switch (totpEnabled()) {
          @case (true) {
            <p class="fr-texto" role="status" style="margin-bottom: var(--space-2);">
              Estado: <strong>Activada</strong>
            </p>
          }
          @case (false) {
            <p class="fr-texto" role="status" style="margin-bottom: var(--space-2);">
              Estado: <strong>Sin configurar</strong>
            </p>
          }
          @default {
            <p class="fr-texto-sm" role="status" style="margin-bottom: var(--space-2);">
              {{ totpStatusError() ? 'No pudimos consultar el estado.' : 'Consultando estado...' }}
            </p>
          }
        }
        <p class="fr-texto-sm" style="margin-bottom: var(--space-4);">
          Es obligatoria para entrar a FusaRoute. Si cambiaste de teléfono, vuelve a configurarla.
        </p>
        <button type="button" class="fr-btn fr-btn-bloque" (click)="reenrolling.set(true)"
                style="background: var(--superficie); border: var(--trazo-2) solid var(--borde);">
          Volver a configurar mi app autenticadora
        </button>

        <!-- Códigos de respaldo: solo tienen sentido con el factor ya activo -->
        @if (totpEnabled() === true) {
          <h3 class="fr-titulo-3" style="margin: var(--space-6) 0 var(--space-2);">Códigos de respaldo</h3>

          @if (newRecoveryCodes(); as codes) {
            <div class="fr-alerta" role="alert" style="margin-bottom: var(--space-4);">
              <strong>Guárdalos ahora:</strong> no se volverán a mostrar, y tus códigos anteriores
              dejaron de servir.
            </div>
            <ul class="fr-lista" style="margin-bottom: var(--space-4);" aria-label="Códigos de respaldo nuevos">
              @for (code of codes; track code) {
                <li><code style="font-size: 16px; user-select: all;">{{ code }}</code></li>
              }
            </ul>
            <div style="display: flex; flex-wrap: wrap; gap: var(--space-2);">
              <button type="button" class="fr-btn" (click)="copyRecoveryCodes()">Copiar códigos</button>
              <button type="button" class="fr-btn" (click)="downloadRecoveryCodes()">Descargar .txt</button>
              <button type="button" class="fr-btn" (click)="newRecoveryCodes.set(null)">Ya los guardé</button>
            </div>
          } @else {
            <p class="fr-texto-sm" style="margin-bottom: var(--space-4);">
              Son tu única salida si pierdes el teléfono, y cada uno sirve una sola vez. Si ya los
              gastaste o no sabes dónde están, genera unos nuevos.
            </p>
            @if (recoveryCodesError()) {
              <p class="fr-alerta" role="alert">{{ recoveryCodesError() }}</p>
            }
            <button type="button" class="fr-btn fr-btn-bloque" [disabled]="regeneratingCodes()"
                    (click)="regenerateRecoveryCodes()"
                    style="background: var(--superficie); border: var(--trazo-2) solid var(--borde);">
              {{ regeneratingCodes() ? 'Generando...' : 'Generar códigos de respaldo nuevos' }}
            </button>
          }
        }
      }
    </div>
      <img class="fr-sticker fr-pegar" style="--r:-4deg;--d:.4s;left:8px;bottom:12px;height:154px" src="assets/stickers/indio-sutagao.webp" width="77" height="154" alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low">
      <img class="fr-sticker fr-pegar" style="--r:-3deg;--d:.6s;right:8px;bottom:12px;height:152px" src="assets/stickers/lucho-herrera.webp" width="91" height="152" alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low">
      <div class="fr-franja-arhuaca fr-franja-arhuaca--inversa" aria-hidden="true"></div>
    </div>
  `,
  styles: [],
})
export class ProfileComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly totpService = inject(TotpService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  profileForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
  });

  passwordForm: FormGroup = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  // Signals de estado
  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);
  readonly profileError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  private readonly fieldErrors = signal<FieldViolation[]>([]);
  readonly totpEnabled = signal<boolean | null>(null);
  readonly totpStatusError = signal(false);
  readonly reenrolling = signal(false);
  /** Códigos recién generados, en claro. Solo viven en memoria y se descartan al salir de la vista. */
  readonly newRecoveryCodes = signal<string[] | null>(null);
  readonly regeneratingCodes = signal(false);
  readonly recoveryCodesError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadTotpStatus();

    this.userService.getMe().subscribe({
      next: (profile: UserProfile) => {
        this.profileForm.patchValue({
          name: profile.name,
          email: profile.email,
          phone: profile.phone ?? '',
        });
      },
      error: () => this.toast.show('No se pudo cargar el perfil', 'error'),
    });
  }

  private loadTotpStatus(): void {
    this.totpService.getStatus().subscribe({
      next: (status) => this.totpEnabled.set(status.enabled),
      error: () => this.totpStatusError.set(true),
    });
  }

  /** El componente de enrolamiento ya dejó la sesión con el token nuevo; solo se vuelve a la vista. */
  onReenrolled(): void {
    this.reenrolling.set(false);
    this.loadTotpStatus();
    // Confirmar el enrolamiento ya reemplazó los respaldos y el componente los mostró:
    // volver a pintarlos aquí sería mostrar un conjunto viejo.
    this.newRecoveryCodes.set(null);
    this.toast.show('Verificación en dos pasos actualizada', 'success');
  }

  regenerateRecoveryCodes(): void {
    this.regeneratingCodes.set(true);
    this.recoveryCodesError.set(null);

    this.totpService.regenerateRecoveryCodes().subscribe({
      next: (res) => {
        this.regeneratingCodes.set(false);
        this.newRecoveryCodes.set(res.recoveryCodes);
      },
      error: (err: HttpErrorResponse) => {
        this.regeneratingCodes.set(false);
        const body = err.error as ProblemDetail | undefined;
        this.recoveryCodesError.set(body?.detail ?? 'No pudimos generar códigos nuevos. Inténtalo de nuevo.');
      },
    });
  }

  async copyRecoveryCodes(): Promise<void> {
    const ok = await copyText((this.newRecoveryCodes() ?? []).join('\n'));
    this.toast.show(ok ? 'Códigos copiados' : 'No se pudo copiar', ok ? 'success' : 'error');
  }

  downloadRecoveryCodes(): void {
    downloadText('fusaroute-codigos-de-respaldo.txt', (this.newRecoveryCodes() ?? []).join('\n'));
  }

  /** Devuelve el mensaje de error del backend para un campo, si existe. */
  fieldError(field: string): string | null {
    return this.fieldErrors().find((v) => v.field === field)?.message ?? null;
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;
    this.savingProfile.set(true);
    this.profileError.set(null);
    this.fieldErrors.set([]);

    const { name, email, phone } = this.profileForm.value;
    this.userService
      .updateMe({ name, email, phone: phone || null })
      .subscribe({
        next: (updated: UserProfile) => {
          this.savingProfile.set(false);
          this.authService.patchUserName(updated.name);
          this.toast.show('¡Quedó melo! Perfil actualizado', 'success');
        },
        error: (err: HttpErrorResponse) => {
          this.savingProfile.set(false);
          this.handleError(err, 'profileError');
        },
      });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) return;
    this.savingPassword.set(true);
    this.passwordError.set(null);
    this.fieldErrors.set([]);

    this.userService
      .changePassword(this.passwordForm.value)
      .subscribe({
        next: () => {
          this.savingPassword.set(false);
          this.passwordForm.reset();
          this.toast.show('Contraseña actualizada', 'success');
        },
        error: (err: HttpErrorResponse) => {
          this.savingPassword.set(false);
          this.handleError(err, 'passwordError');
        },
      });
  }

  private handleError(err: HttpErrorResponse, errorSignal: 'profileError' | 'passwordError'): void {
    const body = err.error as ProblemDetail | undefined;
    if (body?.errors?.length) {
      this.fieldErrors.set(body.errors);
    }
    const detail = body?.detail ?? 'Ocurrió un error inesperado';
    const sig = errorSignal === 'profileError' ? this.profileError : this.passwordError;
    if (err.status === 409) {
      sig.set('Este correo electrónico ya se encuentra registrado.');
    } else {
      sig.set(detail);
    }
  }
}
