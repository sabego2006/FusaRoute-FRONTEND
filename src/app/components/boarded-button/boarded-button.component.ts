import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RideService } from '../../services/ride.service';
import { Ride, RideDraft } from '../../models/ride.model';

export type BoardedState = 'idle' | 'saving' | 'done' | 'error';

/**
 * "¡Ya me subí!": botón con forma de buseta bajo el resultado de la búsqueda.
 *
 * Estados: normal → guardando → "✓ ¡Buen viaje!" (queda inhabilitado: no se repite para
 * el mismo resultado) o error (se puede reintentar). Un resultado nuevo (otro `draft`)
 * lo devuelve a normal. El rebote de la confirmación se apaga con movimiento reducido.
 */
@Component({
  selector: 'app-boarded-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button"
            class="fr-buseta"
            [class.fr-buseta--lista]="state() === 'done'"
            [class.fr-buseta--error]="state() === 'error'"
            [class.fr-btn--trabajando]="state() === 'saving'"
            [disabled]="state() === 'saving' || state() === 'done'"
            [attr.aria-busy]="state() === 'saving'"
            data-testid="ya-me-subi"
            (click)="board()">
      <span class="fr-buseta__ventanas" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="13" rx="3"/>
          <path d="M3 11h18M8 4v7M16 4v7"/>
          <circle cx="7.5" cy="19" r="1.6"/><circle cx="16.5" cy="19" r="1.6"/>
        </svg>
      </span>
      <span class="fr-buseta__texto">{{ label() }}</span>
    </button>
    <p class="fr-solo-lectores" role="status">{{ announcement() }}</p>
    @if (state() === 'error') {
      <p class="fr-texto-sm fr-buseta__nota" role="alert">No pudimos guardar el viaje. Toque de nuevo para reintentar.</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .fr-buseta {
      position: relative;
      display: flex; align-items: center; justify-content: center; gap: var(--space-3);
      width: 100%;
      min-height: 56px;
      padding: var(--space-3) var(--space-5) calc(var(--space-3) + 4px);
      border: var(--trazo-2) solid var(--borde);
      /* Techo redondeado y chasis casi recto: la silueta de una buseta de frente. */
      border-radius: 22px 22px var(--radius-sm) var(--radius-sm);
      background: var(--amarillo-congestion);
      color: var(--sobre-amarillo);
      font: 700 18px/1.2 var(--font-display);
      cursor: pointer;
      box-shadow: var(--shadow-elevated);
      transition: transform var(--vel-rapida) var(--curva-salida), background var(--vel-media);
    }
    /* Las dos llantas. */
    .fr-buseta::before, .fr-buseta::after {
      content: ""; position: absolute; bottom: -7px;
      width: 18px; height: 10px;
      background: var(--tinta); border-radius: 0 0 9px 9px;
    }
    .fr-buseta::before { left: 22%; }
    .fr-buseta::after { right: 22%; }
    .fr-buseta:active:not(:disabled) { transform: translateY(2px); }
    .fr-buseta:focus-visible { outline: var(--trazo-2) solid var(--foco, var(--tinta)); outline-offset: 3px; }
    .fr-buseta:disabled { cursor: default; }
    .fr-buseta--lista { background: var(--lima); color: var(--sobre-lima); }
    .fr-buseta--lista .fr-buseta__texto { animation: fr-pop var(--vel-media) var(--curva-resorte) both; }
    .fr-buseta--error { background: var(--rojo-suave); color: var(--tinta); }
    .fr-buseta__ventanas { display: inline-flex; }
    .fr-buseta__nota { margin: var(--space-3) 0 0; color: var(--rojo-texto); }
    @media (prefers-reduced-motion: reduce) {
      .fr-buseta { transition: none; }
      .fr-buseta--lista .fr-buseta__texto { animation: none; }
    }
  `],
})
export class BoardedButtonComponent {
  private readonly rides = inject(RideService);

  /** Lo que se guarda al tocar. `null` deja el botón inhabilitado. */
  readonly draft = input<RideDraft | null>(null);
  readonly boarded = output<Ride>();

  readonly state = signal<BoardedState>('idle');

  readonly label = computed(() => {
    switch (this.state()) {
      case 'saving': return 'Guardando…';
      case 'done': return '✓ ¡Buen viaje!';
      case 'error': return 'Reintentar: ¡Ya me subí!';
      default: return '¡Ya me subí!';
    }
  });

  readonly announcement = computed(() => this.state() === 'done' ? 'Viaje guardado. ¡Buen viaje!' : '');

  constructor() {
    // Un resultado nuevo es otro viaje: el botón vuelve a estar disponible.
    effect(() => {
      this.draft();
      untracked(() => this.state.set('idle'));
    });
  }

  board(): void {
    const draft = this.draft();
    if (!draft || this.state() === 'saving' || this.state() === 'done') return;
    this.state.set('saving');
    this.rides.board(draft).subscribe({
      next: (ride) => {
        this.state.set('done');
        this.boarded.emit(ride);
      },
      error: () => this.state.set('error'),
    });
  }
}
