import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationReason, UserNotification } from '../../models/notification.model';
import { formatBogota } from '../../lib/bogota-time';

const KEY_PREFIX = 'fusaroute.aviso-suspension.';

function wasDismissed(id: number): boolean {
  try { return sessionStorage.getItem(KEY_PREFIX + id) === '1'; } catch { return false; }
}

function rememberDismissed(id: number): void {
  try { sessionStorage.setItem(KEY_PREFIX + id, '1'); } catch { /* sin almacenamiento: el aviso vuelve a salir */ }
}

/**
 * Avisos in-app de rutas suspendidas (RF-12). No es push: se piden a
 * `GET /api/users/me/notifications` al abrir la app con sesión y al entrar a la
 * pantalla de búsqueda, mientras la suspensión siga vigente.
 *
 * Se puede descartar y el descarte dura **la sesión del navegador** (`sessionStorage`,
 * una clave por `suspensionId`). Sin sesión no se hace ninguna llamada, y si la red
 * falla simplemente no hay aviso: nunca un error en pantalla.
 */
@Component({
  selector: 'app-suspension-notices',
  standalone: true,
  template: `
    @if (visible().length) {
      <div class="fr-avisos" role="status" aria-label="Avisos de rutas suspendidas">
        @for (n of visible(); track n.suspensionId) {
          <div class="fr-aviso">
            <div class="fr-aviso__texto">
              <p class="fr-aviso__titulo">
                La ruta {{ n.routeName }} está suspendida hasta el {{ until(n) }}.
              </p>
              @if (n.reason) {
                <p class="fr-aviso__linea">Motivo: {{ n.reason }}</p>
              }
              <p class="fr-aviso__linea">Te avisamos porque {{ why(n.because) }}.</p>
            </div>
            <button type="button" class="fr-btn" (click)="dismiss(n)"
                    [attr.aria-label]="'Descartar el aviso de la ruta ' + n.routeName">Descartar</button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .fr-avisos { max-width: 1120px; margin: var(--space-3) auto 0; padding: 0 var(--space-4);
      display: flex; flex-direction: column; gap: var(--space-2); box-sizing: border-box; }
    .fr-aviso { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3);
      padding: var(--space-3); background: #FEF3C7; color: #000;
      border: var(--trazo-2) solid var(--borde); border-radius: var(--radius-md); }
    .fr-aviso__texto { min-width: 0; overflow-wrap: anywhere; }
    .fr-aviso__titulo { margin: 0; font-weight: 700; }
    .fr-aviso__linea { margin: var(--space-1) 0 0; font-size: 0.9rem; }
    .fr-aviso .fr-btn { flex: none; min-height: 44px; }
    .fr-aviso .fr-btn:focus-visible { outline: 3px solid var(--foco); outline-offset: 2px; }
  `],
})
export class SuspensionNoticesComponent {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  private readonly items = signal<UserNotification[]>([]);
  private readonly dismissed = signal<ReadonlySet<number>>(new Set());
  private loading = false;

  protected readonly visible = computed(() =>
    this.items().filter((n) => !this.dismissed().has(n.suspensionId) && !wasDismissed(n.suspensionId)));

  constructor() {
    // Al abrir la app (o al iniciar sesión) y al cerrar sesión.
    effect(() => {
      const logged = this.auth.isLoggedIn();
      untracked(() => (logged ? this.load() : this.items.set([])));
    });
    // Al entrar a la pantalla de búsqueda se vuelve a preguntar: la suspensión pudo cambiar.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((e) => {
        if (e.urlAfterRedirects.startsWith('/rutas/buscar') && this.auth.isLoggedIn()) this.load();
      });
  }

  protected until(n: UserNotification): string {
    return formatBogota(n.endsAt);
  }

  protected why(because: NotificationReason): string {
    return because === 'FAVORITE' ? 'es tu destino favorito' : 'la usas seguido';
  }

  protected dismiss(n: UserNotification): void {
    rememberDismissed(n.suspensionId);
    this.dismissed.update((s) => new Set(s).add(n.suspensionId));
  }

  private load(): void {
    if (this.loading) return;
    this.loading = true;
    this.notifications.list().subscribe({
      next: (list) => {
        this.loading = false;
        this.items.set(Array.isArray(list) ? list : []);
      },
      // Sin red o con error: sin aviso, nunca un error en pantalla.
      error: () => {
        this.loading = false;
        this.items.set([]);
      },
    });
  }
}
