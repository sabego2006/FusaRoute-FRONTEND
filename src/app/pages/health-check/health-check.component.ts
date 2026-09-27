import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthService } from '../../services/health.service';

@Component({
  selector: 'app-health-check',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 20px; font-family: sans-serif;">
      <h1 style="color: #333;">Prueba de Conexión Backend</h1>
      <p style="font-size: 1.2rem;">Estado del servidor: 
        <strong [style.color]="status === 'OK' ? 'green' : (status === 'ERROR' ? 'red' : 'orange')">
          {{ status || 'Cargando...' }}
        </strong>
      </p>
      <div *ngIf="error" style="color: red; margin-top: 10px; border: 1px solid red; padding: 10px; border-radius: 4px;">
        <strong>Error detectando:</strong> {{ error }}
      </div>
      <button (click)="check()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">
        Reintentar Conexión
      </button>
    </div>
  `
})
export class HealthCheckComponent implements OnInit {
  status: string = '';
  error: string = '';

  constructor(
    private healthService: HealthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log('[HealthCheck] Componente inicializado');
    this.check();
  }

  check() {
    console.log('[HealthCheck] Iniciando verificación de salud...');
    this.status = 'Cargando...';
    this.error = '';
    
    this.healthService.checkHealth().subscribe({
      next: (res) => {
        console.log('[HealthCheck] Respuesta recibida exitosamente:', res);
        this.status = 'OK';
        this.cdr.detectChanges(); // Forzar a Angular a repintar la pantalla
      },
      error: (err) => {
        console.error('[HealthCheck] Error detectado en la petición:', err);
        this.status = 'ERROR';
        this.error = err.message || 'Error desconocido en la comunicación con el servidor';
        this.cdr.detectChanges();
      }
    });
  }
}
