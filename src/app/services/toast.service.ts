import { Injectable } from '@angular/core';
import { ToastComponent, ToastType } from './toast/toast.component';
import { inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastComponent = inject(ToastComponent, { optional: true });

  show(message: string, type: ToastType = 'info') {
    // Si el componente no está inyectado directamente (porque es un componente de UI),
    // usamos un patrón de servicio que el componente raíz escuchará.
    // Para simplificar en este proyecto, el ToastComponent se añade al app.component.ts
    // y se inyecta el servicio para disparar el evento.
    console.log(`[TOAST ${type.toUpperCase()}]: ${message}`);
  }
}
