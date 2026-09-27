import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="register-container">
      <h2>Crear Cuenta</h2>
      <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label>Nombre</label>
          <input formControlName="name" type="text" placeholder="Tu nombre completo">
          <small *ngIf="registerForm.get('name')?.touched && registerForm.get('name')?.invalid" class="error">
            El nombre es requerido.
          </small>
        </div>

        <div class="form-group">
          <label>Correo Electrónico</label>
          <input formControlName="email" type="email" placeholder="ejemplo@correo.com">
          <small *ngIf="registerForm.get('email')?.touched && registerForm.get('email')?.invalid" class="error">
            Ingrese un correo válido.
          </small>
        </div>

        <div class="form-group">
          <label>Contraseña</label>
          <input formControlName="password" type="password" placeholder="Mínimo 8 caracteres">
          <small *ngIf="registerForm.get('password')?.touched && registerForm.get('password')?.invalid" class="error">
            La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.
          </small>
        </div>

        <div *ngIf="errorMessage" class="alert-error">
          {{ errorMessage }}
        </div>

        <button type="submit" [disabled]="registerForm.invalid">Registrarse</button>
      </form>
    </div>
  `,
  styles: [`
    .register-container { max-width: 400px; margin: 2rem auto; padding: 2rem; border: 1px solid #ccc; border-radius: 8px; font-family: sans-serif; }
    .form-group { margin-bottom: 1rem; display: flex; flex-direction: column; }
    .error { color: red; font-size: 0.8rem; }
    .alert-error { background: #fee; color: red; padding: 10px; margin-bottom: 1rem; border: 1px solid red; border-radius: 4px; }
    button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:disabled { background: #ccc; }
  `]
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage: string = '';

  constructor(private fb: FormBuilder, private http: HttpClient) {
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
      this.http.post(`${environment.apiUrl}/api/auth/register`, this.registerForm.value).subscribe({
        next: () => {
          alert('Cuenta creada con éxito');
          // Aquí iría la redirección al login
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
