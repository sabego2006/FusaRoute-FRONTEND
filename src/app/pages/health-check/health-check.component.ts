import { Component, OnInit, inject, signal } from '@angular/core';
import { HealthService } from '../../services/health.service';

@Component({
  selector: 'app-health-check',
  standalone: true,
  template: `
    <div class="fr-pagina">
      <div class="fr-franja-arhuaca" aria-hidden="true"></div>
    <!-- T05: misma piel que el resto de la app (antes era una página sin estilos). -->
    <div class="fr-card fr-card--paramo" style="max-width: 480px; margin: 2rem auto;">
      <p class="fr-chip-letrero" style="margin-bottom: var(--space-3);">Diagnóstico · FusaRoute</p>
      <h1 class="fr-titulo-1 fr-titulo-cartel"><span class="fr-cartel-1">Prueba de conexión con</span> <span class="fr-cartel-2">el backend</span></h1>
      <div class="fr-greca fr-greca--fina fr-greca--paramo" aria-hidden="true" style="margin: var(--space-3) 0;"></div>
      <p class="fr-texto">Estado del servidor:
        <strong [class.fr-texto-paramo]="status() === 'OK'" [style.color]="status() === 'ERROR' ? 'var(--rojo-texto)' : null">
          {{ status() || 'Cargando...' }}
        </strong>
      </p>
      @if (error()) {
        <div class="fr-suta-estado fr-suta-estado--error" role="alert">
          <img src="assets/mascot/suta-de-pie.webp" alt="" aria-hidden="true" class="fr-suta fr-suta-sm" width="48" height="48" loading="lazy" decoding="async">
          <div><p><strong>Error:</strong> {{ error() }}</p></div>
        </div>
      }
      <button type="button" class="fr-btn fr-btn-primario" style="margin-top: var(--space-4);" (click)="check()">
        Reintentar Conexión
      </button>
    </div>
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
