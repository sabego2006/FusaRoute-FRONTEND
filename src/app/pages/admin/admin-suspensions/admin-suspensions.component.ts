import { Component, ElementRef, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SuspensionService } from '../../../services/suspension.service';
import { AdminRouteService } from '../../../services/admin-route.service';
import { ToastService } from '../../../components/toast/toast.service';
import { AdminRouteSummary } from '../../../models/admin-route.model';
import { FieldViolation, ProblemDetail } from '../../../models/auth.model';
import {
  SUSPENSION_REASON_MAX,
  Suspension,
  SuspensionFilter,
  SuspensionState,
} from '../../../models/suspension.model';
import { bogotaLocalToIso, formatBogota } from '../../../lib/bogota-time';

const FORBIDDEN_MESSAGE = 'No tienes permiso de administrador.';
const OVERLAP_MESSAGE = 'Ya existe una suspensión que se solapa con esa ventana para esta ruta.';
const DELETED_MESSAGE = 'La ruta está eliminada (inactiva) y no se puede suspender.';

type FormField = 'routeId' | 'startsAt' | 'endsAt' | 'reason';

/**
 * Suspensiones temporales de rutas del administrador (RF-12, SCRUM-25).
 *
 * Suspender es temporal y distinto de eliminar: la ruta deja de salir en búsquedas
 * mientras dure la ventana y reaparece sola al terminar (o al reactivarla a mano).
 *
 * Las fechas se capturan y se muestran **siempre en hora de Colombia**, sin importar la
 * zona del navegador: el `datetime-local` se envía con offset `-05:00`.
 * Las reglas de verdad (ventana válida, solapes, ruta inactiva) las decide el backend;
 * aquí solo se anticipa lo obvio para dar mejor experiencia.
 */
@Component({
  selector: 'app-admin-suspensions',
  standalone: true,
  template: `
    <section class="fr-susp">
      <header>
        <h1 class="fr-titulo-1" style="margin-bottom: var(--space-1);">Suspensiones de rutas</h1>
        <p class="fr-texto-sm" style="color: var(--tinta-suave); margin: 0;">
          Suspender es temporal: la ruta no sale en las búsquedas durante la ventana. Todas las horas son de Colombia.
        </p>
      </header>

      <form class="fr-susp__form" (submit)="$event.preventDefault(); submit()" novalidate
            aria-labelledby="susp-form-titulo">
        <h2 id="susp-form-titulo" class="fr-titulo-3" style="margin: 0;">Suspender una ruta</h2>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="susp-ruta">Ruta</label>
          <select id="susp-ruta" class="fr-input" [value]="routeId()" (change)="onRoute($event)"
                  [class.is-invalido]="!!fieldError('routeId')"
                  [attr.aria-invalid]="fieldError('routeId') ? 'true' : null"
                  [attr.aria-describedby]="fieldError('routeId') ? 'susp-ruta-error' : null">
            <option value="">Elige una ruta activa</option>
            @for (r of activeRoutes(); track r.id) {
              <option [value]="r.id" [selected]="routeId() === '' + r.id">{{ r.name }}</option>
            }
          </select>
          @if (fieldError('routeId'); as e) {
            <p id="susp-ruta-error" class="fr-ayuda-error" role="alert">{{ e }}</p>
          }
        </div>

        <div class="fr-susp__fechas">
          <div class="fr-campo">
            <label class="fr-etiqueta" for="susp-inicio">Inicio (hora de Colombia)</label>
            <input id="susp-inicio" class="fr-input" type="datetime-local"
                   [value]="startsAt()" (input)="onStart($event)"
                   [class.is-invalido]="!!fieldError('startsAt')"
                   [attr.aria-invalid]="fieldError('startsAt') ? 'true' : null"
                   [attr.aria-describedby]="fieldError('startsAt') ? 'susp-inicio-error' : null">
            @if (fieldError('startsAt'); as e) {
              <p id="susp-inicio-error" class="fr-ayuda-error" role="alert">{{ e }}</p>
            }
          </div>
          <div class="fr-campo">
            <label class="fr-etiqueta" for="susp-fin">Fin (hora de Colombia)</label>
            <input id="susp-fin" class="fr-input" type="datetime-local"
                   [value]="endsAt()" (input)="onEnd($event)"
                   [class.is-invalido]="!!fieldError('endsAt')"
                   [attr.aria-invalid]="fieldError('endsAt') ? 'true' : null"
                   [attr.aria-describedby]="fieldError('endsAt') ? 'susp-fin-error' : null">
            @if (fieldError('endsAt'); as e) {
              <p id="susp-fin-error" class="fr-ayuda-error" role="alert">{{ e }}</p>
            }
          </div>
        </div>

        <div class="fr-campo">
          <label class="fr-etiqueta" for="susp-motivo">Motivo (opcional)</label>
          <textarea id="susp-motivo" class="fr-input" rows="2" [value]="reason()" (input)="onReason($event)"
                    [attr.maxlength]="reasonMax + 20"
                    [class.is-invalido]="!!fieldError('reason')"
                    [attr.aria-invalid]="fieldError('reason') ? 'true' : null"
                    aria-describedby="susp-motivo-contador susp-motivo-error"></textarea>
          <p id="susp-motivo-contador" class="fr-texto-sm" style="margin: var(--space-1) 0 0; color: var(--tinta-suave);">
            {{ reason().length }}/{{ reasonMax }}
          </p>
          <div id="susp-motivo-error">
            @if (fieldError('reason'); as e) {
              <p class="fr-ayuda-error" role="alert">{{ e }}</p>
            }
          </div>
        </div>

        @if (formError()) {
          <p class="fr-alerta" role="alert">{{ formError() }}</p>
        }

        <div>
          <button type="submit" class="fr-btn fr-btn-primario" [disabled]="saving()">
            {{ saving() ? 'Suspendiendo...' : 'Suspender ruta' }}
          </button>
        </div>
      </form>

      <div class="fr-susp__filtros" role="group" aria-label="Filtrar por estado">
        @for (opcion of filtros; track opcion.valor) {
          <button type="button" class="fr-btn"
                  [class.fr-btn-primario]="filtro() === opcion.valor"
                  [attr.aria-pressed]="filtro() === opcion.valor"
                  (click)="setFiltro(opcion.valor)">{{ opcion.etiqueta }}</button>
        }
      </div>

      @if (confirming(); as s) {
        <div class="fr-susp__confirmar" role="alertdialog" aria-labelledby="susp-conf-titulo"
             aria-describedby="susp-conf-texto">
          <h2 id="susp-conf-titulo" class="fr-titulo-3" style="margin: 0;">¿Reactivar «{{ s.routeName }}»?</h2>
          <p id="susp-conf-texto" class="fr-texto" style="margin: 0;">
            La ruta vuelve a aparecer en las búsquedas de inmediato, antes de que termine la ventana.
          </p>
          <div class="fr-susp__acciones">
            <button type="button" class="fr-btn fr-btn-primario" [disabled]="busyId() === s.id"
                    (click)="confirmLift(s)">
              {{ busyId() === s.id ? 'Reactivando...' : 'Sí, reactivar' }}
            </button>
            <button #cancelLift type="button" class="fr-btn" (click)="confirmingId.set(null)">Cancelar</button>
          </div>
        </div>
      }

      @if (actionError()) {
        <p class="fr-alerta" role="alert">{{ actionError() }}</p>
      }

      @if (loading()) {
        <p class="fr-texto" role="status">Cargando suspensiones...</p>
      } @else if (loadError()) {
        <p class="fr-alerta" role="alert">{{ loadError() }}</p>
      } @else if (items().length === 0) {
        <p class="fr-texto" role="status" style="color: var(--tinta-suave);">No hay suspensiones en esta vista.</p>
      } @else {
        <table class="fr-tabla">
          <caption class="fr-solo-lectores">Suspensiones de rutas con su ventana y estado</caption>
          <thead>
            <tr>
              <th scope="col">Ruta</th>
              <th scope="col">Ventana (hora de Colombia)</th>
              <th scope="col">Motivo</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (s of items(); track s.id) {
              <tr>
                <th scope="row" data-label="Ruta" class="fr-tabla__nombre">{{ s.routeName }}</th>
                <td data-label="Ventana">{{ window(s) }}</td>
                <td data-label="Motivo">{{ s.reason || 'Sin motivo' }}</td>
                <td data-label="Estado"><span class="fr-estado">{{ stateText(s.state) }}</span></td>
                <td data-label="Acciones">
                  @if (s.state === 'ACTIVE' || s.state === 'UPCOMING') {
                    <button type="button" class="fr-btn" [disabled]="busyId() === s.id"
                            [attr.aria-label]="'Reactivar la ruta ' + s.routeName"
                            (click)="askLift(s)">Reactivar</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: [`
    .fr-susp { max-width: 1120px; margin: 2rem auto; display: flex; flex-direction: column; gap: var(--space-4); }
    .fr-susp__form, .fr-susp__confirmar {
      display: flex; flex-direction: column; gap: var(--space-3);
      padding: var(--space-4);
      border: var(--trazo-2) solid var(--borde); border-radius: var(--radius-md);
      background: var(--superficie);
    }
    .fr-susp__confirmar { background: var(--rojo-suave); }
    .fr-susp__fechas { display: grid; grid-template-columns: 1fr; gap: var(--space-3); }
    .fr-susp__filtros, .fr-susp__acciones { display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .fr-susp select.fr-input, .fr-susp textarea.fr-input { width: 100%; box-sizing: border-box; }
    .fr-susp textarea.fr-input { padding: var(--space-2) var(--space-3); resize: vertical; }
    .fr-susp .fr-btn:focus-visible, .fr-susp .fr-input:focus-visible { outline: 3px solid var(--foco); outline-offset: 2px; }

    .fr-tabla { width: 100%; border-collapse: separate; border-spacing: 0; background: var(--superficie);
      border: var(--trazo-2) solid var(--borde); border-radius: var(--radius-md); overflow: hidden; }
    .fr-tabla th, .fr-tabla td { text-align: left; padding: var(--space-3); vertical-align: middle;
      border-bottom: var(--trazo-1) solid var(--borde); font: 500 0.95rem/1.3 var(--font-sans); }
    .fr-tabla thead th { font-weight: 700; background: var(--indigo-suave); }
    .fr-tabla tbody tr:last-child > * { border-bottom: 0; }
    .fr-tabla__nombre { font-weight: 700; overflow-wrap: anywhere; }
    .fr-estado { display: inline-block; padding: 2px var(--space-3); border-radius: var(--radius-full);
      border: var(--trazo-2) solid var(--borde); font: 700 0.8rem/1.4 var(--font-sans); white-space: nowrap; }

    @media (min-width: 640px) { .fr-susp__fechas { grid-template-columns: 1fr 1fr; } }
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
      .fr-tabla__nombre::before { content: none; }
      .fr-tabla td[data-label='Acciones'] { display: block; }
      .fr-tabla td[data-label='Acciones']::before { content: none; }
    }
  `],
})
export class AdminSuspensionsComponent implements OnInit {
  private readonly service = inject(SuspensionService);
  private readonly routesService = inject(AdminRouteService);
  private readonly toast = inject(ToastService);

  protected readonly reasonMax = SUSPENSION_REASON_MAX;
  protected readonly filtros: readonly { valor: SuspensionFilter; etiqueta: string }[] = [
    { valor: 'active', etiqueta: 'Vigentes' },
    { valor: 'upcoming', etiqueta: 'Próximas' },
    { valor: 'past', etiqueta: 'Pasadas' },
    { valor: 'all', etiqueta: 'Todas' },
  ];

  protected readonly filtro = signal<SuspensionFilter>('active');
  protected readonly items = signal<Suspension[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly confirmingId = signal<number | null>(null);
  protected readonly confirming = computed(() => {
    const id = this.confirmingId();
    return id === null ? null : this.items().find((s) => s.id === id) ?? null;
  });

  protected readonly routes = signal<AdminRouteSummary[]>([]);
  protected readonly activeRoutes = computed(() => this.routes().filter((r) => r.status === 'ACTIVA'));

  protected readonly routeId = signal('');
  protected readonly startsAt = signal('');
  protected readonly endsAt = signal('');
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  private readonly fieldErrors = signal<FieldViolation[]>([]);

  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelLift');

  constructor() {
    // Al abrirse la confirmación el foco pasa al botón seguro (Cancelar).
    effect(() => this.cancelButton()?.nativeElement.focus());
  }

  ngOnInit(): void {
    this.fetch();
    this.routesService.list().subscribe({
      next: (list) => this.routes.set(list),
      error: () => this.routes.set([]),
    });
  }

  protected setFiltro(f: SuspensionFilter): void {
    this.filtro.set(f);
    this.loading.set(true);
    this.loadError.set(null);
    this.fetch();
  }

  protected window(s: Suspension): string {
    return `${formatBogota(s.startsAt)} → ${formatBogota(s.endsAt)}`;
  }

  protected stateText(state: SuspensionState): string {
    switch (state) {
      case 'ACTIVE': return 'Vigente';
      case 'UPCOMING': return 'Próxima';
      case 'ENDED': return 'Terminada';
      case 'LIFTED': return 'Reactivada';
    }
  }

  protected fieldError(field: FormField): string | null {
    return this.fieldErrors().find((e) => e.field === field
      || (field === 'routeId' && e.field === 'route'))?.message ?? null;
  }

  protected onRoute(e: Event): void { this.routeId.set((e.target as HTMLSelectElement).value); this.clear('routeId'); }
  protected onStart(e: Event): void { this.startsAt.set((e.target as HTMLInputElement).value); this.clear('startsAt'); }
  protected onEnd(e: Event): void { this.endsAt.set((e.target as HTMLInputElement).value); this.clear('endsAt'); }
  protected onReason(e: Event): void { this.reason.set((e.target as HTMLTextAreaElement).value); this.clear('reason'); }

  private clear(field: FormField): void {
    this.fieldErrors.update((l) => l.filter((e) => e.field !== field));
  }

  protected submit(): void {
    if (this.saving()) return;
    this.formError.set(null);
    const errors: FieldViolation[] = [];
    const id = Number(this.routeId());
    if (!this.routeId() || !Number.isInteger(id)) errors.push({ field: 'routeId', message: 'Elige la ruta que quieres suspender.' });
    const startIso = bogotaLocalToIso(this.startsAt());
    const endIso = bogotaLocalToIso(this.endsAt());
    if (!startIso) errors.push({ field: 'startsAt', message: 'Indica cuándo empieza la suspensión.' });
    if (!endIso) errors.push({ field: 'endsAt', message: 'Indica cuándo termina la suspensión.' });
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      errors.push({ field: 'endsAt', message: 'El fin debe ser posterior al inicio.' });
    }
    if (this.reason().length > SUSPENSION_REASON_MAX) {
      errors.push({ field: 'reason', message: `El motivo admite máximo ${SUSPENSION_REASON_MAX} caracteres.` });
    }
    this.fieldErrors.set(errors);
    if (errors.length || !startIso || !endIso) return;

    const reason = this.reason().trim();
    this.saving.set(true);
    this.service.create(id, { startsAt: startIso, endsAt: endIso, ...(reason ? { reason } : {}) }).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.toast.show(`«${s.routeName}» quedó suspendida.`, 'success');
        this.routeId.set('');
        this.startsAt.set('');
        this.endsAt.set('');
        this.reason.set('');
        this.fetch();
      },
      error: (err: HttpErrorResponse) => this.onCreateError(err),
    });
  }

  private onCreateError(err: HttpErrorResponse): void {
    this.saving.set(false);
    if (err.status === 401) return;
    const body = err.error as ProblemDetail | undefined;
    if (err.status === 400 && body?.errors?.length) {
      this.fieldErrors.set(body.errors);
    } else if (err.status === 403) {
      this.formError.set(FORBIDDEN_MESSAGE);
    } else if (err.status === 404) {
      this.formError.set('Esa ruta ya no existe. Actualizamos la lista.');
      this.reloadRoutes();
    } else if (err.status === 409) {
      const deleted = /inactiv|elimin/i.test(body?.detail ?? '');
      this.formError.set(deleted ? DELETED_MESSAGE : OVERLAP_MESSAGE);
      if (deleted) this.reloadRoutes();
    } else {
      this.formError.set(body?.detail ?? 'No pudimos crear la suspensión. Inténtalo de nuevo.');
    }
  }

  protected askLift(s: Suspension): void {
    this.actionError.set(null);
    this.confirmingId.set(s.id);
  }

  protected confirmLift(s: Suspension): void {
    if (this.busyId() !== null) return;
    this.busyId.set(s.id);
    this.actionError.set(null);
    this.service.lift(s.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.confirmingId.set(null);
        this.toast.show(`«${s.routeName}» fue reactivada.`, 'success');
        this.fetch();
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set(null);
        this.confirmingId.set(null);
        if (err.status === 401) return;
        if (err.status === 403) this.actionError.set(FORBIDDEN_MESSAGE);
        else if (err.status === 404) { this.actionError.set('Esa suspensión ya no existe. Actualizamos la lista.'); this.fetch(); }
        else if (err.status === 409) { this.actionError.set('Esa suspensión ya terminó o ya estaba reactivada.'); this.fetch(); }
        else this.actionError.set('No pudimos reactivar la ruta. Inténtalo de nuevo.');
      },
    });
  }

  private reloadRoutes(): void {
    this.routesService.list().subscribe({ next: (l) => this.routes.set(l), error: () => undefined });
  }

  private fetch(): void {
    this.service.list(this.filtro()).subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 401) return;
        this.loadError.set(err.status === 403
          ? FORBIDDEN_MESSAGE
          : 'No pudimos cargar las suspensiones. Inténtalo de nuevo.');
      },
    });
  }
}
