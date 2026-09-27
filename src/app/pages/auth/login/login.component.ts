import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-container">
      <h2>Iniciar Sesión</h2>
      <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label>Correo Electrónico</label>
          <input formControlName="email" type="email" placeholder="ejemplo@correo.com">
        </div>

        <div class="form-group">
          <label>Contraseña</label>
          <input formControlName="password" type="password" placeholder="Tu contraseña">
        </div>

        <div *ngIf="errorMessage" class="alert-error">
          {{ errorMessage }}
        </div>

        <button type="submit" [disabled]="loginForm.invalid">Entrar</button>
      </form>
      <p class="footer-text">¿No tienes cuenta? <a routerLink="/registro">Regístrate aquí</a></p>
    </div>
  `,
  styles: [`
    .login-container { max-width: 400px; margin: 2rem auto; padding: 2rem; border: 1px solid #ccc; border-radius: 8px; font-family: sans-serif; }
    .form-group { margin-bottom: 1rem; display: flex; flex-direction: column; }
    .alert-error { background: #fee; color: red; padding: 10px; margin-bottom: 1rem; border: 1px solid red; border-radius: 4px; }
    button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:disabled { background: #ccc; }
    .footer-text { margin-top: 1rem; text-align: center; font-size: 0.9rem; font-family: sans-serif; }
  `]
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
          // Mensaje genérico por seguridad (SCRUM-39)
          this.errorMessage = 'Correo o contraseña incorrectos.';
        }
      });
    }
  }
}
