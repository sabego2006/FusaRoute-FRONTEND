import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  message: string;
  kind: ToastKind;
}

/**
 * Servicio de notificaciones transitorias (reemplaza alert()).
 * El toast se muestra 4 s y desaparece solo, sin botón (regla de la CLAUDE.md).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly current = signal<Toast | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, kind: ToastKind = 'info'): void {
    if (this.timer) clearTimeout(this.timer);
    this.current.set({ message, kind });
    this.timer = setTimeout(() => this.current.set(null), 4000);
  }
}
