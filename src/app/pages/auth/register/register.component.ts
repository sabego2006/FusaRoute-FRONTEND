import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="fr-card" style="max-width: 400px; margin: 2rem auto;">
      <div class="fr-barra" style="margin-bottom: var(--space-6); display: flex; justify-content: center;">
        <span class="fr-wordmark">Fusa<b>Route</b></span>
      </div>

      <h1 class="fr-titulo-1" style="text-align: center; margin-bottom: var(--space-4);">Crear Cuenta</h1>
      <p class="fr-texto-sm" style="text-align: center; margin-bottom: var(--space-6);">Únete a la comunidad y guarda tus rutas favoritas.</p>

      <div *ngIf="errorMessage" class="fr-alerta" role="alert" style="margin-bottom: var(--space-4);">
        <strong>Error:</strong> {{ errorMessage }}
      </div>

      <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div class="fr-campo">
          <label class="fr-etiqueta" for="name">Nombre</label>
          <input id="name" class="fr-input" formControlName="name" type="text" placeholder="Tu nombre completo">
          <p *ngIf="registerForm.get('name')?.touched && registerForm.get('name')?.invalid" class="fr-ayuda-error">
            El nombre es requerido.
          </p>
        </div>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="email">Correo Electrónico</label>
          <input id="email" class="fr-input" formControlName="email" type="email" placeholder="ejemplo@correo.com">
          <p *ngIf="registerForm.get('email')?.touched && registerForm.get('email')?.invalid" class="fr-ayuda-error">
            Ingrese un correo válido.
          </p>
        </div>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="password">Contraseña</label>
          <input id="password" class="fr-input" formControlName="password" type="password" placeholder="Mínimo 8 caracteres">
          <p *ngIf="registerForm.get('password')?.touched && registerForm.get('password')?.invalid" class="fr-ayuda-error">
            La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.
          </p>
        </div>

        <button type="submit" class="fr-btn fr-btn-primario fr-btn-bloque" [disabled]="registerForm.invalid">
          Registrarse
        </button>
      </form>

      <p class="fr-texto-sm" style="margin-top: var(--space-6); text-align: center;">
        ¿Ya tienes cuenta? <a class="fr-link" routerLink="/login">Inicia sesión aquí</a>
      </p>
    </div>
  `,
  styles: [] // Estilos movidos a src/styles.css mediante clases .fr-
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage: string = '';

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern('^(?=.*[A-Z])(?=.*[0-9]).*$')
      ]]
    });
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.errorMessage = '';
      this.authService.register(this.registerForm.value).subscribe({
        next: () => {
          alert('Cuenta creada con éxito');
          this.router.navigate(['/login']);
        },
        error: (err) => {
          if (err.status === 409) {
            this.errorMessage = 'Este correo electrónico ya se encuentra registrado.';
          } else {
            this.errorMessage = 'Ocurrió un error al registrar la cuenta. Inténtelo más tarde.';
          }
        }
      });
    }
  }
}
