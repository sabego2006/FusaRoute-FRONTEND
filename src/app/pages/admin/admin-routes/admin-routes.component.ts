import { Component, ElementRef, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AdminRouteService } from '../../../services/admin-route.service';
import { ToastService } from '../../../components/toast/toast.service';
import { AdminRouteStatus, AdminRouteSummary } from '../../../models/admin-route.model';
import { ProblemDetail } from '../../../models/auth.model';
import { formatCop } from '../../../lib/format';
import { normalizeKey } from '../../../lib/admin-route-form';

const FORBIDDEN_MESSAGE = 'No tienes permiso de administrador.';

/** `'TODAS'` no es un estado del backend: es la ausencia de filtro. */
type Filtro = 'TODAS' | AdminRouteStatus;

/**
 * Lista de gestión de rutas del administrador (RF-11, SCRUM-24).
 *
 * Muestra **todas** las rutas, inactivas incluidas, y el estado va siempre como texto
 * dentro de un badge: el color solo refuerza, nunca es la única señal.
 *
 * **Eliminar es reversible** (soft delete: la ruta pasa a INACTIVA y deja de verse en
 * el catálogo público). Por eso la confirmación lo dice con esas palabras y no con un
 * "¿Seguro?" genérico, y por eso INACTIVA ofrece Restaurar.
 *
 * El filtro y la búsqueda son sobre la lista ya cargada: son solo de pantalla, no una
 * regla de negocio. Que la ruta exista, esté activa o se pueda restaurar lo decide el
 * backend.
 */
@Component({
  selector: 'app-admin-routes',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="fr-rutas">
      <header class="fr-rutas__cabecera">
        <div>
          <h1 class="fr-titulo-1" style="margin-bottom: var(--space-1);">Gestión de rutas</h1>
          <p class="fr-texto-sm" style="color: var(--tinta-suave); margin: 0;">
            Aquí ves todas las rutas, también las inactivas.
          </p>
        </div>
        <a class="fr-btn fr-btn-primario" routerLink="nueva">Crear ruta</a>
      </header>

      <div class="fr-rutas__filtros">
        <div class="fr-campo fr-rutas__buscar">
          <label class="fr-etiqueta" for="buscar-ruta">Buscar por nombre</label>
          <input id="buscar-ruta" class="fr-input" type="search" autocomplete="off"
                 placeholder="Ej. Fusagasugá"
                 [value]="query()" (input)="onQuery($event)">
        </div>
        <div role="group" aria-label="Filtrar por estado" class="fr-rutas__estados">
          @for (opcion of filtros; track opcion.valor) {
            <button type="button" class="fr-btn"
                    [class.fr-btn-primario]="filtro() === opcion.valor"
                    [attr.aria-pressed]="filtro() === opcion.valor"
                    (click)="filtro.set(opcion.valor)">{{ opcion.etiqueta }}</button>
          }
        </div>
      </div>

      @if (confirmingRoute(); as ruta) {
        <div class="fr-rutas__confirmar" role="alertdialog" aria-labelledby="confirmar-titulo"
             aria-describedby="confirmar-texto">
          <h2 id="confirmar-titulo" class="fr-titulo-3" style="margin: 0;">
            ¿Eliminar «{{ ruta.name }}»?
          </h2>
          <p id="confirmar-texto" class="fr-texto" style="margin: 0;">
            Es reversible: la ruta pasa a INACTIVA, deja de verse en el catálogo público
            y puedes restaurarla desde esta pantalla cuando quieras.
          </p>
          <div class="fr-rutas__acciones">
            <button type="button" class="fr-btn fr-btn-primario"
                    [disabled]="busyId() === ruta.id"
                    (click)="confirmDelete(ruta)">
              {{ busyId() === ruta.id ? 'Eliminando...' : 'Sí, eliminar' }}
            </button>
            <button #cancelDelete type="button" class="fr-btn" (click)="cancelConfirm()">Cancelar</button>
          </div>
        </div>
      }

      @if (actionError()) {
        <p class="fr-alerta" role="alert">{{ actionError() }}</p>
      }

      @if (loading()) {
        <p class="fr-texto" role="status">Cargando rutas...</p>
      } @else if (loadError()) {
        <p class="fr-alerta" role="alert">{{ loadError() }}</p>
      } @else if (routes().length === 0) {
        <p class="fr-texto" style="color: var(--tinta-suave);">Todavía no hay rutas. Crea la primera.</p>
      } @else if (visible().length === 0) {
        <p class="fr-texto" role="status" style="color: var(--tinta-suave);">
          Ninguna ruta coincide con la búsqueda o el filtro.
        </p>
      } @else {
        <p class="fr-texto-sm" role="status" style="color: var(--tinta-suave);">
          {{ visible().length }} de {{ routes().length }} rutas
        </p>

        <table class="fr-tabla">
          <caption class="fr-solo-lectores">Rutas del sistema con su estado y tarifa actual</caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Tipo</th>
              <th scope="col">Estado</th>
              <th scope="col">Tarifa actual</th>
              <th scope="col">Actualizada</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (r of visible(); track r.id) {
              <tr>
                <th scope="row" data-label="Nombre" class="fr-tabla__nombre">{{ r.name }}</th>
                <td data-label="Tipo">{{ r.type === 'URBANA' ? 'Urbana' : 'Intermunicipal' }}</td>
                <td data-label="Estado">
                  <span class="fr-estado" [class]="'fr-estado fr-estado--' + r.status.toLowerCase()">
                    {{ estadoTexto(r.status) }}
                  </span>
                </td>
                <td data-label="Tarifa actual">{{ fare(r) }}</td>
                <td data-label="Actualizada">{{ date(r.updatedAt) }}</td>
                <td data-label="Acciones">
                  <div class="fr-rutas__acciones">
                    <a class="fr-btn" [routerLink]="[r.id, 'editar']"
                       [attr.aria-label]="'Editar la ruta ' + r.name">Editar</a>
                    @if (r.status === 'INACTIVA') {
                      <button type="button" class="fr-btn"
                              [disabled]="busyId() === r.id"
                              [attr.aria-label]="'Restaurar la ruta ' + r.name"
                              (click)="restore(r)">
                        {{ busyId() === r.id ? 'Restaurando...' : 'Restaurar' }}
                      </button>
                    } @else {
                      <button type="button" class="fr-btn"
                              [attr.aria-label]="'Eliminar la ruta ' + r.name"
                              (click)="askDelete(r)">Eliminar</button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: [`
    .fr-rutas { max-width: 1120px; margin: 2rem auto; display: flex; flex-direction: column; gap: var(--space-4); }
    .fr-rutas__cabecera { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
    .fr-rutas__filtros { display: flex; align-items: flex-end; gap: var(--space-4); flex-wrap: wrap; }
    .fr-rutas__buscar { flex: 1 1 240px; min-width: 0; }
    .fr-rutas__estados { display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .fr-rutas__acciones { display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .fr-rutas__confirmar {
      display: flex; flex-direction: column; gap: var(--space-3);
      padding: var(--space-4);
      border: var(--trazo-2) solid var(--borde); border-radius: var(--radius-md);
      background: var(--rojo-suave);
    }
    a.fr-btn { text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }

    .fr-tabla { width: 100%; border-collapse: separate; border-spacing: 0; background: var(--superficie);
      border: var(--trazo-2) solid var(--borde); border-radius: var(--radius-md); overflow: hidden; }
    .fr-tabla th, .fr-tabla td { text-align: left; padding: var(--space-3); vertical-align: middle;
      border-bottom: var(--trazo-1) solid var(--borde); font: 500 0.95rem/1.3 var(--font-sans); }
    .fr-tabla thead th { font-weight: 700; background: var(--indigo-suave); }
    .fr-tabla tbody tr:last-child > * { border-bottom: 0; }
    .fr-tabla__nombre { font-weight: 700; overflow-wrap: anywhere; }

    .fr-estado {
      display: inline-block; padding: 2px var(--space-3); border-radius: var(--radius-full);
      border: var(--trazo-2) solid var(--borde); font: 700 0.8rem/1.4 var(--font-sans); white-space: nowrap;
    }
    .fr-estado--activa { background: #D9F99D; color: #000; }
    .fr-estado--suspendida { background: #FEF3C7; color: #000; }
    .fr-estado--inactiva { background: var(--fondo); color: var(--tinta-suave); border-style: dashed; }

    /*
     * A 640 px o menos la tabla no cabe: cada fila pasa a tarjeta y cada celda lleva su
     * encabezado delante (data-label). El encabezado de la tabla se oculta a la vista
     * pero sigue ahí para el lector de pantalla.
     */
    @media (max-width: 640px) {
      .fr-tabla, .fr-tabla tbody, .fr-tabla tr, .fr-tabla th, .fr-tabla td { display: block; }
      .fr-tabla { border: 0; background: transparent; border-radius: 0; overflow: visible; }
      .fr-tabla thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      .fr-tabla tbody { display: flex; flex-direction: column; gap: var(--space-3); }
      .fr-tabla tr { background: var(--superficie); border: var(--trazo-2) solid var(--borde);
        border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); }
      .fr-tabla th, .fr-tabla td { border-bottom: 0; padding: var(--space-2) 0; }
      .fr-tabla td { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
      .fr-tabla td::before { content: attr(data-label); font-weight: 700; color: var(--tinta-suave); flex: none; }
      .fr-tabla__nombre { font-size: 1.05rem; }
      .fr-tabla__nombre::before { content: none; }
      .fr-tabla td[data-label='Acciones'] { display: block; }
      .fr-tabla td[data-label='Acciones']::before { content: none; }
    }
  `],
})
export class AdminRoutesComponent implements OnInit {
  private readonly service = inject(AdminRouteService);
  private readonly toast = inject(ToastService);

  protected readonly filtros: readonly { valor: Filtro; etiqueta: string }[] = [
    { valor: 'TODAS', etiqueta: 'Todas' },
    { valor: 'ACTIVA', etiqueta: 'Activas' },
    { valor: 'SUSPENDIDA', etiqueta: 'Suspendidas' },
    { valor: 'INACTIVA', etiqueta: 'Inactivas' },
  ];

  protected readonly routes = signal<AdminRouteSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly query = signal('');
  protected readonly filtro = signal<Filtro>('TODAS');
  protected readonly confirmingId = signal<number | null>(null);
  protected readonly busyId = signal<number | null>(null);

  protected readonly visible = computed(() => {
    const needle = normalizeKey(this.query());
    const filtro = this.filtro();
    return this.routes().filter((r) =>
      (filtro === 'TODAS' || r.status === filtro)
      && (needle === '' || normalizeKey(r.name).includes(needle)));
  });

  protected readonly confirmingRoute = computed(() => {
    const id = this.confirmingId();
    return id === null ? null : this.routes().find((r) => r.id === id) ?? null;
  });

  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelDelete');

  constructor() {
    // Al abrirse la confirmación el foco pasa al botón seguro (Cancelar): un teclado que
    // seguía en "Eliminar" quedaría fuera del aviso, y Enter dispararía lo irreversible
    // de otra confirmación.
    effect(() => this.cancelButton()?.nativeElement.focus());
  }

  ngOnInit(): void {
    this.load();
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected estadoTexto(status: AdminRouteStatus): string {
    return status === 'ACTIVA' ? 'Activa' : status === 'SUSPENDIDA' ? 'Suspendida' : 'Inactiva';
  }

  protected fare(route: AdminRouteSummary): string {
    return route.currentFare === null ? 'Sin tarifa' : formatCop(route.currentFare);
  }

  /** Fecha corta en hora local; vacío si el backend mandara algo ilegible. */
  protected date(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  protected askDelete(route: AdminRouteSummary): void {
    this.actionError.set(null);
    this.confirmingId.set(route.id);
  }

  protected cancelConfirm(): void {
    this.confirmingId.set(null);
  }

  protected confirmDelete(route: AdminRouteSummary): void {
    if (this.busyId() !== null) return;
    this.busyId.set(route.id);
    this.actionError.set(null);
    this.service.remove(route.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.confirmingId.set(null);
        this.toast.show(`«${route.name}» quedó inactiva. Puedes restaurarla.`, 'success');
        this.reload();
      },
      error: (err: HttpErrorResponse) => this.onActionError(err, 'No pudimos eliminar la ruta.'),
    });
  }

  protected restore(route: AdminRouteSummary): void {
    if (this.busyId() !== null) return;
    this.busyId.set(route.id);
    this.actionError.set(null);
    this.service.restore(route.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.show(`«${route.name}» fue restaurada.`, 'success');
        this.reload();
      },
      error: (err: HttpErrorResponse) => this.onActionError(err, 'No pudimos restaurar la ruta.'),
    });
  }

  private onActionError(err: HttpErrorResponse, fallback: string): void {
    this.busyId.set(null);
    this.confirmingId.set(null);
    // Del 401 se encarga authInterceptor (cierra la sesión y lleva al login).
    if (err.status === 401) return;
    const body = err.error as ProblemDetail | undefined;
    if (err.status === 403) {
      this.actionError.set(FORBIDDEN_MESSAGE);
    } else if (err.status === 404) {
      this.actionError.set('Esa ruta ya no existe. Se actualizó la lista.');
      this.reload();
    } else {
      // El 409 al restaurar trae en `detail` la regla que falló: se prefiere al genérico.
      this.actionError.set(body?.detail ?? fallback);
    }
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.fetch();
  }

  /** Recarga sin volver a mostrar "Cargando": la lista no parpadea tras una acción. */
  private reload(): void {
    this.fetch();
  }

  private fetch(): void {
    this.service.list().subscribe({
      next: (list) => {
        this.routes.set(list);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 401) return;
        this.loadError.set(err.status === 403
          ? FORBIDDEN_MESSAGE + ' Si acabas de recibirlo, cierra sesión y vuelve a entrar: el rol viaja dentro del token.'
          : 'No pudimos cargar las rutas. Inténtalo de nuevo.');
      },
    });
  }
}
