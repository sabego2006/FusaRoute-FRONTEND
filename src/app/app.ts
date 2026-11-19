import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ToastComponent } from './components/toast/toast.component';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav.component';
import { SuspensionNoticesComponent } from './components/suspension-notices/suspension-notices.component';
import { NavigationFailureStore } from './core/navigation-failure.store';
import { ConnectivityService } from './core/connectivity.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ToastComponent, BottomNavComponent, SuspensionNoticesComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly connectivity = inject(ConnectivityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly failures = inject(NavigationFailureStore);

  /** Pantalla que no se pudo cargar, para decirlo en vez de dejar la vista en blanco (T15). */
  readonly failedUrl = this.failures.failedUrl;
  readonly isOnline = this.connectivity.isOnline;

  /** Una sola recarga automática por carga de documento: nunca un bucle de recargas. */
  private alreadyReloaded = false;

  constructor() {
    // Si la pantalla se cayó por falta de red, se vuelve a cargar sola apenas vuelva: la
    // vista está en blanco, así que no hay nada que el usuario pueda perder.
    this.connectivity.reconnections()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.failures.failedUrl() !== null && !this.alreadyReloaded) {
          this.alreadyReloaded = true;
          this.reload();
        }
      });
  }

  /**
   * Volver a cargar el documento es la única salida real: el navegador recuerda que la
   * descarga de ese módulo falló y un `import()` nuevo del mismo archivo ya no pide nada.
   */
  reload(): void {
    const url = this.failures.failedUrl();
    this.failures.clear();
    if (typeof window !== 'undefined') {
      window.location.assign(url ?? window.location.pathname);
    }
  }
}
