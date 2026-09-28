import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ToastType = 'success' | 'error' | 'info';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div class="toast" [class]="'toast-' + type()">
        {{ message() }}
      </div>
    }
  `,
  styles: [`
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 1rem 2rem;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
      min-width: 250px;
      text-align: center;
    }
    .toast-success { background: #2A6F4A; }
    .toast-error { background: #b91c1c; }
    .toast-info { background: #0E2A47; }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class ToastComponent {
  message = signal('');
  type = signal<ToastType>('info');
  visible = signal(false);

  show(msg: string, type: ToastType = 'info') {
    this.message.set(msg);
    this.type.set(type);
    this.visible.set(true);
    setTimeout(() => this.visible.set(false), 3000);
  }
}
