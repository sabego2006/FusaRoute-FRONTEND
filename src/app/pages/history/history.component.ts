import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService } from '../../services/user.service';
import { SearchHistoryEntry } from '../../models/history.model';
import { ProblemDetail } from '../../models/auth.model';

/**
 * Pantalla del historial de búsquedas (RF-07, SCRUM-82).
 *
 * Muestra las últimas 6 búsquedas de la cuenta, de la más reciente a la más antigua, y
 * repite cualquiera de ellas con un toque. El tope, el orden y la disponibilidad los
 * decide el backend: aquí no se recorta, no se reordena y no se consulta el catálogo.
 *
 * El historial vive en la cuenta, no en el dispositivo, así que la pantalla exige sesión
 * (el `authGuard` de la ruta) y no guarda nada en `localStorage`.
 */
@Component({
  selector: 'app-history',
  standalone: true,
  template: `
    <div style="max-width: 640px; margin: 2rem auto; padding: 0 var(--space-4);">
      <!-- T05 (R2): la placa de la buseta como eyebrow de la pantalla. -->
      <p class="fr-chip-letrero" style="margin-bottom: var(--space-3);">Tu cuenta · FusaRoute</p>
      <h1 class="fr-titulo-1" style="margin-bottom: var(--space-2);">Mis búsquedas</h1>
      <p class="fr-texto-sm" style="color: var(--tinta-suave); margin-bottom: var(--space-4);">
        Las últimas 6 búsquedas de tu cuenta. Las ves iguales desde cualquier dispositivo.
      </p>
      <div class="fr-greca fr-greca--paramo" aria-hidden="true" style="max-width: 240px; margin-bottom: var(--space-6);"></div>

      @if (loading()) {
        <p class="fr-texto" role="status">Cargando tu historial…</p>
      } @else if (errorMessage()) {
        <!-- T05 (R4): Sutá acompaña el error. -->
        <div class="fr-suta-estado fr-suta-estado--error" role="alert">
          <img src="assets/mascot/suta-de-pie.webp" alt="" aria-hidden="true" class="fr-suta fr-suta-sm" width="48" height="48" loading="lazy" decoding="async">
          <div><p>{{ errorMessage() }}</p></div>
        </div>
      } @else if (isEmpty()) {
        <!-- T05 (R4): estado vacío con Sutá. -->
        <div class="fr-suta-estado" style="align-items: flex-start;">
          <img src="assets/mascot/suta-pointing.webp" alt="" aria-hidden="true" class="fr-suta" width="96" height="96" loading="lazy" decoding="async">
          <div>
            <p class="fr-texto" style="margin: 0 0 var(--space-4);">
              Todavía no has buscado ninguna ruta. Las búsquedas que hagas aparecerán aquí.
            </p>
            <button type="button" class="fr-btn fr-btn-primario" (click)="goToSearch()">
              Buscar una ruta
            </button>
          </div>
        </div>
      } @else {
        <ul class="fr-lista" style="display: flex; flex-direction: column; gap: var(--space-3);">
          @for (entry of entries(); track entry.id) {
            <li>
              <!--
                Un <button> y no un <div> con (click): repetir la búsqueda es una acción,
                y así se alcanza con el teclado y el lector de pantalla lo anuncia como
                pulsable. La entrada no disponible va deshabilitada en vez de oculta — el
                criterio pide que se siga viendo (RF-11).
              -->
              <button
                type="button"
                class="fr-card fr-card-interactiva"
                style="width: 100%; text-align: left; display: flex; flex-direction: column;
                       gap: var(--space-2); font: inherit; cursor: pointer;"
                [disabled]="!isAvailable(entry)"
                [attr.aria-label]="ariaLabelFor(entry)"
                (click)="repeat(entry)">
                <span style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
                  <span class="fr-chip-lugar">{{ entry.origin }}</span>
                  <span aria-hidden="true" style="color: var(--tinta-suave);">→</span>
                  <span class="fr-chip-lugar">{{ entry.destination }}</span>
                </span>

                @if (isAvailable(entry)) {
                  <span class="fr-texto-sm" style="color: var(--tinta-suave);">
                    {{ formatDate(entry.searchedAt) }} · <strong class="fr-texto-paramo">Toca para repetir</strong>
                  </span>
                } @else {
                  <!--
                    Nada de "ruta eliminada": al usuario no le interesaba una ruta, le
                    interesaba el trayecto, y lo que ya no hay es con qué hacerlo.
                  -->
                  <span class="fr-texto-sm" style="color: var(--rojo-texto); font-weight: 600;">
                    Ruta ya no disponible
                  </span>
                  <span class="fr-texto-sm" style="color: var(--tinta-suave);">
                    {{ formatDate(entry.searchedAt) }}
                  </span>
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class HistoryComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly entries = signal<SearchHistoryEntry[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly isEmpty = computed(() => this.entries().length === 0);

  ngOnInit(): void {
    this.userService.getHistory().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error as ProblemDetail | undefined;
        this.errorMessage.set(
          body?.detail ?? 'No pudimos cargar tu historial. Intenta de nuevo en un momento.',
        );
      },
    });
  }

  /**
   * Una entrada sin la clave `routeAvailable` se trata como disponible: significa que el
   * backend desplegado todavía no la manda, y no que el trayecto se haya perdido.
   */
  isAvailable(entry: SearchHistoryEntry): boolean {
    return entry.routeAvailable ?? true;
  }

  /**
   * Repetir es volver al buscador con ese par ya puesto. Los barrios viajan por la URL
   * y no por un servicio de estado compartido: así la búsqueda repetida se puede
   * compartir, recargar y volver atrás, y la pantalla de búsqueda sigue siendo la única
   * dueña de cómo se busca.
   */
  repeat(entry: SearchHistoryEntry): void {
    if (!this.isAvailable(entry)) {
      return;
    }
    this.navigate(['/rutas/buscar'], {
      origen: entry.origin,
      destino: entry.destination,
    });
  }

  goToSearch(): void {
    this.navigate(['/rutas/buscar']);
  }

  /** Fecha corta en hora local, que es como el usuario reconoce su propia búsqueda. */
  formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  ariaLabelFor(entry: SearchHistoryEntry): string {
    const trayecto = `${entry.origin} a ${entry.destination}`;
    return this.isAvailable(entry)
      ? `Repetir la búsqueda de ${trayecto}`
      : `${trayecto}: ruta ya no disponible`;
  }

  private navigate(path: string[], queryParams?: Record<string, string>): void {
    // navigate() rechaza si falla la carga diferida del chunk de destino (por ejemplo,
    // un despliegue nuevo invalidó el hash). Se registra en vez de dejar la promesa suelta.
    this.router
      .navigate(path, queryParams ? { queryParams } : undefined)
      .catch((err) => console.error('Navegación desde el historial fallida', err));
  }
}
