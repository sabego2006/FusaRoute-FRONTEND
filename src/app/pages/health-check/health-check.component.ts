import { Component, OnInit, inject, signal } from '@angular/core';
import { HealthService } from '../../services/health.service';

@Component({
  selector: 'app-health-check',
  standalone: true,
  template: `
    <div style="padding: 20px; font-family: sans-serif;">
      <h1 style="color: #333;">Prueba de Conexión Backend</h1>
      <p style="font-size: 1.2rem;">Estado del servidor:
        <strong [style.color]="status() === 'OK' ? 'green' : (status() === 'ERROR' ? 'red' : 'orange')">
          {{ status() || 'Cargando...' }}
        </strong>
      </p>
      @if (error()) {
        <div style="color: red; margin-top: 10px; border: 1px solid red; padding: 10px; border-radius: 4px;">
          <strong>Error:</strong> {{ error() }}
        </div>
      }
      <button (click)="check()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">
        Reintentar Conexión
      </button>
    </div>
  `,
})
export class HealthCheckComponent implements OnInit {
  private readonly healthService = inject(HealthService);

  readonly status = signal('');
  readonly error = signal('');

  ngOnInit(): void {
    this.check();
  }

  check(): void {
    this.status.set('Cargando...');
    this.error.set('');
    this.healthService.checkHealth().subscribe({
      next: () => this.status.set('OK'),
      error: (err: { message?: string }) => {
        this.status.set('ERROR');
        this.error.set(err.message ?? 'Error desconocido en la comunicación con el servidor');
      },
    });
  }
}
