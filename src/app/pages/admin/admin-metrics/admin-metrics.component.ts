import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AdminMetricsService } from '../../../services/admin-metrics.service';
import { AdminMetrics } from '../../../models/admin-metrics.model';
import { formatBogotaTime } from '../../../lib/bogota-time';
import { ADMIN_SECTIONS } from '../admin-layout/admin-layout.component';

const FORBIDDEN_MESSAGE = 'No tienes permiso de administrador.';
const GENERIC_ERROR = 'No pudimos cargar las métricas. Intenta de nuevo.';

/**
 * Panel de métricas del administrador (RF-13, SCRUM-26).
 *
 * Muestra exactamente cinco métricas y el estado del momento en que se abre o se
 * pulsa "Recargar": **sin polling, sin temporizadores y sin selector de rango**.
 * El 401 lo resuelve `authInterceptor` (limpia sesión y manda al login); aquí solo
 * se distingue el 403 del resto de errores. El permiso real lo verifica el backend.
 */
@Component({
  selector: 'app-admin-metrics',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="fr-metricas">
      <h1 class="fr-titulo-1">Métricas de uso</h1>

      @if (loading()) {
        <p class="fr-solo-lectores" role="status">Cargando métricas...</p>
        <div class="fr-metricas__grid" aria-hidden="true">
          @for (hueco of [1, 2, 3, 4]; track hueco) {
            <div class="fr-esq-card">
              <div class="fr-esqueleto fr-esq-linea fr-esq-linea--media"></div>
              <div class="fr-esqueleto fr-esq-titulo"></div>
            </div>
          }
        </div>
        <div class="fr-esq-card" aria-hidden="true">
          <div class="fr-esqueleto fr-esq-titulo"></div>
          <div class="fr-esqueleto fr-esq-linea"></div>
          <div class="fr-esqueleto fr-esq-linea fr-esq-linea--media"></div>
        </div>
      } @else if (error()) {
        <div class="fr-alerta" role="alert">
          <p style="margin: 0 0 var(--space-3);">{{ error() }}</p>
          @if (!forbidden()) {
            <button type="button" class="fr-btn" (click)="load()">Reintentar</button>
          }
        </div>
      } @else if (metrics(); as m) {
        <div class="fr-metricas__grid">
          <section class="fr-card" aria-labelledby="m-usuarios">
            <h2 id="m-usuarios" class="fr-metricas__etiqueta">Usuarios registrados</h2>
            <p class="fr-metricas__valor">{{ fmt(m.totalUsers) }}</p>
          </section>

          <section class="fr-card" aria-labelledby="m-busquedas">
            <h2 id="m-busquedas" class="fr-metricas__etiqueta">Búsquedas de hoy</h2>
            <p class="fr-metricas__valor">{{ fmt(m.searchesToday) }}</p>
          </section>

          <section class="fr-card" aria-labelledby="m-comentarios">
            <h2 id="m-comentarios" class="fr-metricas__etiqueta">Comentarios pendientes</h2>
            <p class="fr-metricas__valor">{{ fmt(m.pendingComments) }}</p>
            <a class="fr-metricas__enlace" routerLink="/admin/comentarios">Ver comentarios</a>
          </section>

          <section class="fr-card" aria-labelledby="m-suspensiones">
            <h2 id="m-suspensiones" class="fr-metricas__etiqueta">Suspensiones activas</h2>
            <p class="fr-metricas__valor">{{ fmt(m.activeSuspensions) }}</p>
            @if (suspensionsLinkVisible) {
              <a class="fr-metricas__enlace" routerLink="/admin/suspensiones">Ver suspensiones</a>
            }
          </section>
        </div>

        <section class="fr-card" aria-labelledby="m-ranking">
          <h2 id="m-ranking" class="fr-titulo-3">Las 5 rutas más consultadas</h2>
          <p class="fr-ayuda">Últimos {{ m.topRoutesWindowDays }} días</p>
          @if (m.topRoutes.length === 0) {
            <p style="color: var(--tinta-suave); margin: 0;">Aún no hay búsquedas registradas</p>
          } @else {
            <ol class="fr-ranking">
              @for (r of m.topRoutes; track r.routeId; let i = $index) {
                <li class="fr-ranking__fila">
                  <span class="fr-ranking__pos">{{ i + 1 }}</span>
                  <a class="fr-ranking__nombre" [routerLink]="['/rutas', r.routeId]">{{ r.routeName }}</a>
                  <span class="fr-ranking__cant">{{ fmt(r.searches) }}
                    <span class="fr-solo-lectores">búsquedas</span></span>
                </li>
              }
            </ol>
          }
        </section>

        <footer class="fr-metricas__pie">
          <p class="fr-ayuda" style="margin: 0;">
            Actualizado a las {{ updatedAt() }} (hora de Colombia)
          </p>
          <button type="button" class="fr-btn" (click)="load()">Recargar</button>
        </footer>
      }
    </div>
  `,
  styles: [`
    .fr-metricas { display: flex; flex-direction: column; gap: var(--space-4); }
    .fr-metricas__grid {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: 1fr;
    }
    @media (min-width: 768px) {
      .fr-metricas__grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (min-width: 1440px) {
      .fr-metricas__grid { grid-template-columns: repeat(4, 1fr); }
    }
    .fr-metricas__etiqueta {
      margin: 0;
      font: 600 0.95rem/1.3 var(--font-sans);
      color: var(--tinta-suave);
    }
    .fr-metricas__valor {
      margin: 0;
      font: 700 2.25rem/1.1 var(--font-display);
      color: var(--tinta);
    }
    .fr-metricas__enlace,
    .fr-ranking__nombre {
      color: var(--indigo-accion);
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .fr-metricas__enlace:focus-visible,
    .fr-ranking__nombre:focus-visible { outline: 3px solid var(--foco); outline-offset: 2px; }
    /* Lista compacta en 320 px, tres columnas desde 600 px. */
    .fr-ranking { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .fr-ranking__fila {
      display: grid;
      grid-template-columns: 2rem 1fr auto;
      gap: var(--space-2);
      align-items: baseline;
      padding: var(--space-2) 0;
      border-top: var(--trazo-1) solid var(--borde);
    }
    .fr-ranking__pos { font-weight: 700; color: var(--tinta-suave); }
    .fr-ranking__cant { font-weight: 600; font-variant-numeric: tabular-nums; }
    @media (min-width: 600px) {
      .fr-ranking__fila { grid-template-columns: 4rem 1fr 8rem; }
      .fr-ranking__cant { text-align: right; }
    }
    .fr-metricas__pie {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
  `],
})
export class AdminMetricsComponent implements OnInit {
  private readonly service = inject(AdminMetricsService);

  protected readonly metrics = signal<AdminMetrics | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly forbidden = signal(false);

  /** Se muestra solo si la sección de suspensiones ya está activa en el menú. */
  protected readonly suspensionsLinkVisible =
    ADMIN_SECTIONS.find(s => s.path === 'suspensiones')?.available ?? false;

  protected readonly updatedAt = computed(() => {
    const m = this.metrics();
    return m ? formatBogotaTime(m.generatedAt) : '';
  });

  private readonly numbers = new Intl.NumberFormat('es-CO');

  ngOnInit(): void {
    this.load();
  }

  protected fmt(n: number): string {
    return this.numbers.format(n);
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.forbidden.set(false);
    this.service.get().subscribe({
      next: (m) => {
        this.metrics.set(m);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.metrics.set(null);
        this.loading.set(false);
        // El 401 ya lo atendió authInterceptor (cierra sesión y va al login).
        if (err.status === 403) {
          this.forbidden.set(true);
          this.error.set(FORBIDDEN_MESSAGE);
        } else {
          this.error.set(GENERIC_ERROR);
        }
      },
    });
  }
}
