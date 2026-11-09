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
      /*
       * Por encima de la barra de navegación inferior, que es de posición
       * fija y taparía el aviso justo cuando hay algo que avisar. Arriba de
       * 760 px la barra no existe y el toast baja al borde.
       *
       * Ojo: nada de acentos graves en los comentarios de este bloque. Todo
       * esto vive dentro de un template literal de JavaScript y un acento
       * grave cierra la cadena, con un error de compilación que apunta al
       * array de estilos y no a la línea culpable.
       */
      bottom: calc(var(--fr-nav-alto) + env(safe-area-inset-bottom) + var(--space-4));
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
      animation: toast-in var(--vel-media) var(--curva-resorte);
    }
    .fr-toast--success { background: #D9F99D; color: #000; }
    .fr-toast--error   { background: var(--rojo-suave, #FEE2E2); color: var(--rojo-texto, #B91C1C); }
    .fr-toast--info    { background: var(--indigo-suave, #EEF2FF); color: var(--indigo, #4F46E5); }

    @media (min-width: 760px) {
      .fr-toast { bottom: var(--space-6); }
    }

    /*
     * Entra empujando desde abajo y se pasa un poco antes de asentarse: con la
     * curva de resorte el aviso se lee como que "llegó", no como que estaba
     * ahí y se encendió. El translateX(-50%) se repite en cada fotograma
     * porque transform es una sola propiedad: si solo se animara translateY
     * se perdería el centrado y el toast saltaría al borde izquierdo.
     */
    @keyframes toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(28px) scale(.96); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .fr-toast { animation: none; }
    }
  `],
})
export class ToastComponent {
  protected readonly toast = inject(ToastService);
}
