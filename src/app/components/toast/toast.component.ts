import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    @if (toast.current(); as t) {
      <div class="fr-toast" [class]="'fr-toast fr-toast--' + t.kind" role="status" aria-live="polite">
        {{ t.message }}
      </div>
    }
  `,
  styles: [`
    .fr-toast {
      position: fixed;
      bottom: var(--space-6);
      left: 50%;
      transform: translateX(-50%);
      padding: var(--space-3) var(--space-6);
      border: var(--trazo-2) solid var(--borde);
      border-radius: var(--radius-md);
      box-shadow: var(--sombra-dura);
      font-family: var(--fuente-cuerpo, sans-serif);
      font-size: 0.95rem;
      z-index: 9999;
      max-width: calc(100vw - 2 * var(--space-4));
      text-align: center;
      animation: toast-in 0.25s ease-out;
    }
    .fr-toast--success { background: #D9F99D; color: #000; }
    .fr-toast--error   { background: var(--rojo-suave, #FEE2E2); color: var(--rojo-texto, #B91C1C); }
    .fr-toast--info    { background: var(--indigo-suave, #EEF2FF); color: var(--indigo, #4F46E5); }

    @keyframes toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(12px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `],
})
export class ToastComponent {
  protected readonly toast = inject(ToastService);
}
