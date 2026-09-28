import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { UserProfile, UpdateProfileRequest } from '../../models/auth.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-container">
      <h1>Mi Perfil</h1>

      <div class="card">
        <form (submit)="saveProfile($event)">
          <div class="form-group">
            <label>Nombre completo</label>
            <input type="text" [(ngModel)]="profile().name" name="name" required>
          </div>

          <div class="form-group">
            <label>Correo electrónico</label>
            <input type="email" [(ngModel)]="profile().email" name="email" required>
          </div>

          <div class="form-group">
            <label>Teléfono</label>
            <input type="text" [(ngModel)]="profile().phone" name="phone">
          </div>

          <div class="actions">
            <button type="submit" [disabled]="loading()">Guardar Cambios</button>
          </div>
        </form>

        @if (errors()) {
          <div class="error-box">
            <p><strong>Hubo un problema:</strong></p>
            <ul>
              @for (err of errors(); track err) {
                <li>{{ err }}</li>
              }
            </ul>
          </div>
        }
      </div>

      <div class="card password-section">
        <h2>Cambiar Contraseña</h2>
        <form (submit)="updatePassword($event)">
          <div class="form-group">
            <label>Contraseña Actual</label>
            <input type="password" [(ngModel)]="passData().current" name="current">
          </div>
          <div class="form-group">
            <label>Nueva Contraseña</label>
            <input type="password" [(ngModel)]="passData().next" name="next">
          </div>
          <div class="actions">
            <button type="submit" [disabled]="loading()">Actualizar Contraseña</button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .profile-container { max-width: 600px; margin: 2rem auto; padding: 0 1rem; font-family: 'Inter', sans-serif; }
    h1 { color: #0E2A47; text-align: center; }
    .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 2rem; }
    .form-group { margin-bottom: 1.2rem; display: flex; flex-direction: column; }
    label { font-weight: 600; margin-bottom: 0.5rem; color: #444; }
    input { padding: 0.8rem; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
    .actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; }
    button { background: #E8743B; color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600; transition: opacity 0.2s; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error-box { background: #fee2e2; color: #b91c1c; padding: 1rem; border-radius: 8px; margin-top: 1rem; border: 1px solid #fca5a5; }
    .password-section { border-top: 4px solid #0E2A47; }
  `]
})
export class ProfileComponent {
  private userService = inject(UserService);
  private authService = inject(AuthService);

  profile = signal<UserProfile>({ name: '', email: '', phone: '' });
  passData = signal({ current: '', next: '' });
  errors = signal<string[]>([]);
  loading = signal(false);

  constructor() {
    this.loadProfile();
  }

  loadProfile() {
    this.userService.getProfile().subscribe({
      next: (user) => {
        this.profile.set(user);
        this.authService.setUserProfile(user);
      },
      error: (err) => this.errors.set(['No se pudo cargar el perfil.'])
    });
  }

  saveProfile(event: Event) {
    event.preventDefault();
    this.loading.set(true);
    this.errors.set([]);

    const request: UpdateProfileRequest = {
      name: this.profile().name,
      email: this.profile().email,
      phone: this.profile().phone || ''
    };

    this.userService.updateProfile(request).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.authService.setUserProfile(updated);
        this.loading.set(false);
        // Aquí iría el Toast de éxito
      },
      error: (err) => {
        this.loading.set(false);
        const violations = err.error?.violations || [err.error?.detail || 'Error al guardar el perfil.'];
        this.errors.set(violations);
      }
    });
  }

  updatePassword(event: Event) {
    event.preventDefault();
    this.loading.set(true);
    this.errors.set([]);

    const request: ChangePasswordRequest = {
      currentPassword: this.passData().current,
      newPassword: this.passData().next
    };

    this.userService.changePassword(request).subscribe({
      next: () => {
        this.loading.set(false);
        this.passData.set({ current: '', next: '' });
        // Aquí iría el Toast de éxito
      },
      error: (err) => {
        this.loading.set(false);
        this.errors.set([err.error?.detail || 'Error al cambiar la contraseña.']);
      }
    });
  }
}
`
}
