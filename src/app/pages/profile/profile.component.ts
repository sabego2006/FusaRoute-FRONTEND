import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../components/toast/toast.service';
import { UserProfile, FieldViolation, ProblemDetail } from '../../models/auth.model';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="fr-card" style="max-width: 480px; margin: 2rem auto;">
      <h1 class="fr-titulo-1" style="margin-bottom: var(--space-6);">Mi perfil</h1>

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

      <!-- Cambiar contraseña -->
      <hr style="margin: var(--space-8) 0; border: 0; border-top: var(--trazo-1) solid var(--borde);">
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
    </div>
  `,
  styles: [],
})
export class ProfileComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
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

  ngOnInit(): void {
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
          this.toast.show('Perfil actualizado', 'success');
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
