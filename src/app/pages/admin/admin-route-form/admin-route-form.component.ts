import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminRouteService } from '../../../services/admin-route.service';
import { ToastService } from '../../../components/toast/toast.service';
import { MapViewComponent } from '../../../components/map-view/map-view.component';
import {
  AdminRouteDetail,
  AdminRouteRequest,
  ROUTE_NAME_MAX,
  ROUTE_NEIGHBORHOODS_MAX,
} from '../../../models/admin-route.model';
import { FieldViolation, ProblemDetail } from '../../../models/auth.model';
import { RouteType } from '../../../models/route.model';
import {
  FareDraft,
  buildFares,
  moveItem,
  normalizeKey,
  parsePathGeoJson,
  sortFares,
  stringifyPath,
  validateFares,
  validateName,
  validateNeighborhoods,
} from '../../../lib/admin-route-form';

const FORBIDDEN_MESSAGE = 'No tienes permiso de administrador.';

/** Campos del cuerpo que tienen su propio sitio en el formulario. */
const KNOWN_FIELDS = ['name', 'pathGeoJson', 'neighborhoods', 'fares', 'signFile'] as const;

/** Fila editable de la tabla de tarifas; `key` solo sirve para que Angular la reconozca al reordenar. */
interface FareRow extends FareDraft {
  key: number;
}

/**
 * Formulario de crear y editar rutas (RF-11, SCRUM-24). Una sola pantalla para las dos
 * rutas (`/admin/rutas/nueva` y `/admin/rutas/:id/editar`): la diferencia es si arranca
 * vacía o con el detalle cargado, y si guarda con POST o con PUT.
 *
 * **El formulario anticipa, el backend manda.** Las reglas de `lib/admin-route-form.ts`
 * dan el mensaje al instante, pero el servidor las vuelve a validar y su 400 por campo se
 * pinta junto al campo. Un 409 es "nombre repetido" y va en el campo nombre.
 *
 * **El tipo cambia las reglas de tarifa**: urbana es un precio solo; intermunicipal es
 * una tabla de punto de referencia + precio, que sale ordenada por monto. El usuario
 * nunca escribe coordenadas a mano en un campo de formulario (SCRUM-130); aquí el
 * trazado se **pega** como GeoJSON porque lo exporta el equipo desde su herramienta de
 * mapas, y se previsualiza en el mapa para verificar que quedó donde debía.
 *
 * Los barrios se reordenan con botones subir/bajar y no solo con arrastre: el arrastre no
 * es accesible por teclado.
 */
@Component({
  selector: 'app-admin-route-form',
  standalone: true,
  imports: [RouterLink, MapViewComponent],
  template: `
    <section class="fr-ruta-form">
      <a class="fr-link" routerLink="/admin/rutas">← Volver a las rutas</a>
      <h1 class="fr-titulo-1">{{ editingId === null ? 'Crear ruta' : 'Editar ruta' }}</h1>

      @if (loading()) {
        <p class="fr-texto" role="status">Cargando la ruta...</p>
      } @else if (loadError()) {
        <p class="fr-alerta" role="alert">{{ loadError() }}</p>
      } @else {
        <form (submit)="onSubmit($event)" novalidate class="fr-ruta-form__form">

          @if (summaryError()) {
            <p class="fr-alerta" role="alert">{{ summaryError() }}</p>
          }
          @if (otherServerErrors().length > 0) {
            <div class="fr-alerta" role="alert">
              <strong>El servidor rechazó estos datos:</strong>
              <ul style="margin: var(--space-1) 0 0; padding-left: var(--space-5);">
                @for (e of otherServerErrors(); track $index) {
                  <li>{{ e.field }}: {{ e.message }}</li>
                }
              </ul>
            </div>
          }

          <!-- Nombre -->
          <div class="fr-campo">
            <label class="fr-etiqueta" for="ruta-nombre">Nombre de la ruta</label>
            <input id="ruta-nombre" class="fr-input" type="text" autocomplete="off"
                   [class.is-invalido]="!!errorFor('name')"
                   [attr.aria-invalid]="errorFor('name') ? 'true' : null"
                   [attr.aria-describedby]="errorFor('name') ? 'ruta-nombre-error' : null"
                   [attr.maxlength]="nameMax"
                   [value]="name()" (input)="onName($event)">
            @if (errorFor('name'); as e) {
              <p id="ruta-nombre-error" class="fr-ayuda-error" role="alert">{{ e }}</p>
            }
          </div>

          <!-- Tipo -->
          <div class="fr-campo">
            <label class="fr-etiqueta" for="ruta-tipo">Tipo</label>
            <select id="ruta-tipo" class="fr-input" [value]="type()" (change)="onType($event)">
              <option value="URBANA">Urbana (un solo precio)</option>
              <option value="INTERMUNICIPAL">Intermunicipal (precio por punto de bajada)</option>
            </select>
          </div>

          <!-- Barrios -->
          <fieldset class="fr-ruta-form__grupo" aria-describedby="barrios-ayuda">
            <legend class="fr-etiqueta">Barrios del recorrido ({{ neighborhoods().length }}/{{ neighborhoodsMax }})</legend>
            <p id="barrios-ayuda" class="fr-texto-sm" style="margin: 0; color: var(--tinta-suave);">
              En el orden en que la ruta los recorre. El catálogo público muestra solo 7 de ellos;
              aquí se aceptan hasta {{ neighborhoodsMax }}.
            </p>

            <div class="fr-ruta-form__fila">
              <div class="fr-campo" style="flex: 1 1 200px; min-width: 0;">
                <label class="fr-etiqueta" for="ruta-barrio-nuevo">Nuevo barrio</label>
                <input id="ruta-barrio-nuevo" class="fr-input" type="text" autocomplete="off"
                       [value]="newNeighborhood()" (input)="onNewNeighborhood($event)"
                       (keydown.enter)="addNeighborhood($event)">
              </div>
              <button type="button" class="fr-btn" (click)="addNeighborhood()"
                      [disabled]="newNeighborhood().trim() === ''">Agregar barrio</button>
            </div>

            @if (neighborhoods().length > 0) {
              <ol class="fr-ruta-form__barrios">
                @for (n of neighborhoods(); track $index; let i = $index; let first = $first; let last = $last) {
                  <li class="fr-ruta-form__barrio">
                    <span class="fr-ruta-form__barrio-nombre">{{ i + 1 }}. {{ n }}</span>
                    <span class="fr-ruta-form__barrio-acciones">
                      <button type="button" class="fr-btn" [disabled]="first"
                              [attr.aria-label]="'Subir ' + n" (click)="moveNeighborhood(i, -1)">Subir</button>
                      <button type="button" class="fr-btn" [disabled]="last"
                              [attr.aria-label]="'Bajar ' + n" (click)="moveNeighborhood(i, 1)">Bajar</button>
                      <button type="button" class="fr-btn"
                              [attr.aria-label]="'Quitar ' + n" (click)="removeNeighborhood(i)">Quitar</button>
                    </span>
                  </li>
                }
              </ol>
            }
            @if (errorFor('neighborhoods'); as e) {
              <p class="fr-ayuda-error" role="alert">{{ e }}</p>
            }
          </fieldset>

          <!-- Tarifas -->
          <fieldset class="fr-ruta-form__grupo">
            <legend class="fr-etiqueta">Tarifa</legend>

            @if (type() === 'URBANA') {
              <div class="fr-campo">
                <label class="fr-etiqueta" for="ruta-tarifa-urbana">Valor del pasaje (COP)</label>
                <input id="ruta-tarifa-urbana" class="fr-input" type="number" inputmode="numeric" min="1" step="50"
                       [class.is-invalido]="!!errorFor('fares')"
                       [attr.aria-invalid]="errorFor('fares') ? 'true' : null"
                       [attr.aria-describedby]="errorFor('fares') ? 'ruta-tarifas-error' : null"
                       [value]="urbanAmount()" (input)="onUrbanAmount($event)">
              </div>
            } @else {
              <p class="fr-texto-sm" style="margin: 0; color: var(--tinta-suave);">
                Un precio por cada punto de referencia donde se baja el pasajero. Se ordenan de menor a mayor.
              </p>
              @for (row of fareRows(); track row.key; let i = $index) {
                <div class="fr-ruta-form__fila">
                  <div class="fr-campo" style="flex: 2 1 180px; min-width: 0;">
                    <label class="fr-etiqueta" [attr.for]="'tarifa-punto-' + row.key">Punto de referencia {{ i + 1 }}</label>
                    <input [id]="'tarifa-punto-' + row.key" class="fr-input" type="text" autocomplete="off"
                           [value]="row.referencePoint" (input)="onFareField(row.key, 'referencePoint', $event)">
                  </div>
                  <div class="fr-campo" style="flex: 1 1 120px; min-width: 0;">
                    <label class="fr-etiqueta" [attr.for]="'tarifa-valor-' + row.key">Valor {{ i + 1 }} (COP)</label>
                    <input [id]="'tarifa-valor-' + row.key" class="fr-input" type="number" inputmode="numeric" min="1" step="50"
                           [value]="row.amount" (input)="onFareField(row.key, 'amount', $event)"
                           (blur)="sortRows()">
                  </div>
                  <button type="button" class="fr-btn" [attr.aria-label]="'Quitar la tarifa ' + (i + 1)"
                          (click)="removeFareRow(row.key)">Quitar</button>
                </div>
              }
              <div>
                <button type="button" class="fr-btn" (click)="addFareRow()">Agregar tarifa</button>
              </div>
            }
            @if (errorFor('fares'); as e) {
              <p id="ruta-tarifas-error" class="fr-ayuda-error" role="alert">{{ e }}</p>
            }
          </fieldset>

          <!-- Señal -->
          <div class="fr-campo">
            <label class="fr-etiqueta" for="ruta-letrero">Señal (opcional)</label>
            <input id="ruta-letrero" class="fr-input" type="text" autocomplete="off"
                   aria-describedby="ruta-letrero-ayuda"
                   [value]="signFile()" (input)="onSignFile($event)">
            <p id="ruta-letrero-ayuda" class="fr-texto-sm" style="margin: var(--space-1) 0 0; color: var(--tinta-suave);">
              Nombre del archivo del letrero, sin «.svg». Ej. ARBELAEZ.
            </p>
            @if (serverFor('signFile'); as e) {
              <p class="fr-ayuda-error" role="alert">{{ e }}</p>
            }
          </div>

          <!-- Trazado -->
          <div class="fr-campo">
            <label class="fr-etiqueta" for="ruta-trazado">Trazado GeoJSON (opcional)</label>
            <textarea id="ruta-trazado" class="fr-input" rows="6" spellcheck="false"
                      aria-describedby="ruta-trazado-ayuda"
                      [class.is-invalido]="!!pathError() || !!serverFor('pathGeoJson')"
                      [attr.aria-invalid]="(pathError() || serverFor('pathGeoJson')) ? 'true' : null"
                      [value]="pathText()" (input)="onPathText($event)"
                      placeholder='{"type":"LineString","coordinates":[[-74.37,4.34],[-74.36,4.35]]}'></textarea>
            <p id="ruta-trazado-ayuda" class="fr-texto-sm" style="margin: var(--space-1) 0 0; color: var(--tinta-suave);">
              Pega solo la geometría <code>LineString</code>. Cada posición va como [longitud, latitud].
            </p>
            @if (pathError() || serverFor('pathGeoJson'); as e) {
              <p class="fr-ayuda-error" role="alert">{{ e }}</p>
            }
          </div>

          @if (preview(); as p) {
            <div>
              <p class="fr-etiqueta" id="ruta-vista-previa">Vista previa del trazado</p>
              <div role="group" aria-labelledby="ruta-vista-previa">
                <!--
                  El mapa pinta el GeoJSON una sola vez, al inicializarse. El @for con
                  track por el texto del trazado lo recrea cada vez que cambia, y así la
                  vista previa sigue lo que hay en el textarea.
                -->
                @for (k of [p.key]; track k) {
                  <app-map-view [path]="p.path" [origin]="p.origin" [destination]="p.destination" />
                }
              </div>
            </div>
          }

          <div class="fr-ruta-form__acciones">
            <button type="submit" class="fr-btn fr-btn-primario" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : (editingId === null ? 'Crear ruta' : 'Guardar cambios') }}
            </button>
            <a class="fr-btn" routerLink="/admin/rutas">Cancelar</a>
          </div>
        </form>
      }
    </section>
  `,
  styles: [`
    .fr-ruta-form { max-width: 760px; margin: 2rem auto; display: flex; flex-direction: column; gap: var(--space-4); }
    .fr-ruta-form__form { display: flex; flex-direction: column; gap: var(--space-5); }
    .fr-ruta-form__grupo {
      display: flex; flex-direction: column; gap: var(--space-3); margin: 0; min-width: 0;
      padding: var(--space-4); border: var(--trazo-2) solid var(--borde); border-radius: var(--radius-md);
    }
    .fr-ruta-form__grupo legend { padding: 0 var(--space-2); }
    .fr-ruta-form__fila { display: flex; align-items: flex-end; gap: var(--space-3); flex-wrap: wrap; }
    .fr-ruta-form__barrios { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .fr-ruta-form__barrio {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap;
      padding: var(--space-2) var(--space-3); border: var(--trazo-1) solid var(--borde); border-radius: var(--radius-md);
      background: var(--superficie);
    }
    .fr-ruta-form__barrio-nombre { overflow-wrap: anywhere; min-width: 0; font: 600 0.95rem/1.3 var(--font-sans); }
    .fr-ruta-form__barrio-acciones { display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .fr-ruta-form__acciones { display: flex; gap: var(--space-3); flex-wrap: wrap; }
    a.fr-btn { text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
    textarea.fr-input { font-family: ui-monospace, Consolas, monospace; font-size: 0.85rem; resize: vertical; }
  `],
})
export class AdminRouteFormComponent implements OnInit {
  private readonly service = inject(AdminRouteService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  protected readonly nameMax = ROUTE_NAME_MAX;
  protected readonly neighborhoodsMax = ROUTE_NEIGHBORHOODS_MAX;

  /** `null` al crear; el id de la ruta al editar. */
  protected editingId: number | null = null;

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);

  protected readonly name = signal('');
  protected readonly type = signal<RouteType>('URBANA');
  protected readonly neighborhoods = signal<string[]>([]);
  protected readonly newNeighborhood = signal('');
  protected readonly urbanAmount = signal('');
  protected readonly fareRows = signal<FareRow[]>([]);
  protected readonly signFile = signal('');
  protected readonly pathText = signal('');

  private readonly serverErrors = signal<FieldViolation[]>([]);
  protected readonly summaryError = signal<string | null>(null);
  private nextRowKey = 1;

  // --- Errores del formulario (anticipan al backend) -------------------------------

  private readonly fareDrafts = computed<FareDraft[]>(() =>
    this.type() === 'URBANA'
      ? [{ referencePoint: '', amount: this.urbanAmount() }]
      : this.fareRows());

  private readonly clientErrors = computed(() => ({
    name: validateName(this.name()),
    neighborhoods: validateNeighborhoods(this.neighborhoods()),
    fares: validateFares(this.type(), this.fareDrafts()),
  }));

  /** El trazado se valida **al instante**, sin esperar al envío: es lo más fácil de pegar mal. */
  protected readonly pathError = computed(() => {
    const result = parsePathGeoJson(this.pathText());
    return result.ok ? null : result.message;
  });

  protected readonly preview = computed(() => {
    const result = parsePathGeoJson(this.pathText());
    if (!result.ok || result.path === null) return null;
    const coords = result.path.coordinates;
    const first = coords[0];
    const last = coords[coords.length - 1];
    // GeoJSON es [lng, lat]; el mapa pide {lat, lng}.
    return {
      key: this.pathText().trim(),
      path: result.path,
      origin: { lat: first[1], lng: first[0] },
      destination: { lat: last[1], lng: last[0] },
    };
  });

  /** Errores del 400 cuyo campo no tiene sitio propio en el formulario. */
  protected readonly otherServerErrors = computed(() =>
    this.serverErrors().filter((e) => !KNOWN_FIELDS.some((f) => matchesField(e.field, f))));

  ngOnInit(): void {
    const raw = this.activatedRoute.snapshot.paramMap.get('id');
    if (raw === null) {
      return;
    }
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      this.loadError.set('Esa ruta no existe.');
      return;
    }
    this.editingId = id;
    this.loading.set(true);
    this.service.get(id).subscribe({
      next: (detail) => {
        this.fill(detail);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 401) return;
        this.loadError.set(err.status === 404
          ? 'Esa ruta ya no existe.'
          : err.status === 403
            ? FORBIDDEN_MESSAGE
            : 'No pudimos cargar la ruta. Inténtalo de nuevo.');
      },
    });
  }

  private fill(detail: AdminRouteDetail): void {
    this.name.set(detail.name);
    this.type.set(detail.type);
    this.neighborhoods.set([...detail.neighborhoods]);
    this.signFile.set(detail.signFile ?? '');
    this.pathText.set(stringifyPath(detail.pathGeoJson));
    if (detail.type === 'URBANA') {
      this.urbanAmount.set(detail.fares[0] ? String(detail.fares[0].amount) : '');
      this.fareRows.set([]);
    } else {
      this.fareRows.set(sortFares(detail.fares.map((f) => this.newRow(f.referencePoint ?? '', String(f.amount)))));
    }
  }

  // --- Qué error mostrar -----------------------------------------------------------

  /** Error de un campo: el del servidor si lo hay, y si no el del formulario (tras el primer envío). */
  protected errorFor(field: 'name' | 'neighborhoods' | 'fares'): string | null {
    const server = this.serverFor(field);
    if (server) return server;
    return this.submitted() ? this.clientErrors()[field] : null;
  }

  protected serverFor(field: string): string | null {
    return this.serverErrors().find((e) => matchesField(e.field, field))?.message ?? null;
  }

  private clearServer(field: string): void {
    if (this.serverErrors().some((e) => matchesField(e.field, field))) {
      this.serverErrors.update((list) => list.filter((e) => !matchesField(e.field, field)));
    }
  }

  // --- Manejadores -----------------------------------------------------------------

  protected onName(event: Event): void {
    this.name.set(valueOf(event));
    this.clearServer('name');
  }

  protected onType(event: Event): void {
    const type = valueOf(event) as RouteType;
    this.type.set(type);
    this.clearServer('fares');
    if (type === 'INTERMUNICIPAL' && this.fareRows().length === 0) {
      this.fareRows.set([this.newRow('', '')]);
    }
  }

  protected onNewNeighborhood(event: Event): void {
    this.newNeighborhood.set(valueOf(event));
  }

  /** Agrega el barrio escrito. Con Enter no debe enviarse el formulario entero. */
  protected addNeighborhood(event?: Event): void {
    event?.preventDefault();
    const value = this.newNeighborhood().trim().replace(/\s+/g, ' ');
    if (value === '') return;
    if (this.neighborhoods().some((n) => normalizeKey(n) === normalizeKey(value))) {
      // Duplicado: no se agrega y el aviso sale al instante, no tras el envío.
      this.summaryError.set(`El barrio "${value}" ya está en la lista.`);
      return;
    }
    if (this.neighborhoods().length >= ROUTE_NEIGHBORHOODS_MAX) {
      this.summaryError.set(`Una ruta admite hasta ${ROUTE_NEIGHBORHOODS_MAX} barrios.`);
      return;
    }
    this.summaryError.set(null);
    this.neighborhoods.update((list) => [...list, value]);
    this.newNeighborhood.set('');
    this.clearServer('neighborhoods');
  }

  protected moveNeighborhood(index: number, delta: -1 | 1): void {
    this.neighborhoods.update((list) => moveItem(list, index, delta));
  }

  protected removeNeighborhood(index: number): void {
    this.neighborhoods.update((list) => list.filter((_, i) => i !== index));
    this.clearServer('neighborhoods');
  }

  protected onUrbanAmount(event: Event): void {
    this.urbanAmount.set(valueOf(event));
    this.clearServer('fares');
  }

  protected onFareField(key: number, field: 'referencePoint' | 'amount', event: Event): void {
    const value = valueOf(event);
    this.fareRows.update((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    this.clearServer('fares');
  }

  protected addFareRow(): void {
    this.fareRows.update((rows) => [...rows, this.newRow('', '')]);
  }

  protected removeFareRow(key: number): void {
    this.fareRows.update((rows) => rows.filter((r) => r.key !== key));
    this.clearServer('fares');
  }

  /** Reordena por monto al salir del campo (no al teclear: la fila se movería bajo el cursor). */
  protected sortRows(): void {
    this.fareRows.update((rows) => sortFares(rows));
  }

  protected onSignFile(event: Event): void {
    this.signFile.set(valueOf(event));
    this.clearServer('signFile');
  }

  protected onPathText(event: Event): void {
    this.pathText.set(valueOf(event));
    this.clearServer('pathGeoJson');
  }

  // --- Envío -----------------------------------------------------------------------

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.saving()) return;

    this.submitted.set(true);
    this.serverErrors.set([]);
    this.summaryError.set(null);

    const errors = this.clientErrors();
    if (errors.name || errors.neighborhoods || errors.fares || this.pathError()) {
      this.summaryError.set('Revisa los campos marcados antes de guardar.');
      return;
    }

    const body = this.buildBody();
    this.saving.set(true);
    const request$ = this.editingId === null
      ? this.service.create(body)
      : this.service.update(this.editingId, body);

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.show(
          this.editingId === null ? `Ruta «${saved.name}» creada.` : `Cambios de «${saved.name}» guardados.`,
          'success',
        );
        this.router.navigate(['/admin/rutas'])
          .catch((err) => console.error('Navegación a la lista de rutas fallida', err));
      },
      error: (err: HttpErrorResponse) => this.onSaveError(err),
    });
  }

  private buildBody(): AdminRouteRequest {
    const parsed = parsePathGeoJson(this.pathText());
    const sign = this.signFile().trim();
    const body: AdminRouteRequest = {
      name: this.name().trim(),
      type: this.type(),
      neighborhoods: this.neighborhoods().map((n) => n.trim()),
      fares: buildFares(this.type(), this.fareDrafts()),
    };
    if (parsed.ok && parsed.path) body.pathGeoJson = parsed.path;
    if (sign !== '') body.signFile = sign;
    return body;
  }

  private onSaveError(err: HttpErrorResponse): void {
    this.saving.set(false);
    // Del 401 se encarga authInterceptor (cierra la sesión y lleva al login).
    if (err.status === 401) return;

    const body = err.error as ProblemDetail | undefined;
    if (err.status === 400 && body?.errors?.length) {
      this.serverErrors.set(body.errors);
      this.summaryError.set('El servidor encontró errores en los datos. Están junto a cada campo.');
    } else if (err.status === 409) {
      // El nombre repetido va en el campo nombre, no en un aviso general.
      this.serverErrors.set([{ field: 'name', message: 'Ya existe una ruta con ese nombre.' }]);
    } else if (err.status === 404) {
      this.summaryError.set('Esa ruta ya no existe. Vuelve a la lista.');
    } else if (err.status === 403) {
      this.summaryError.set(FORBIDDEN_MESSAGE);
    } else {
      this.summaryError.set(body?.detail ?? 'No pudimos guardar la ruta. Inténtalo de nuevo.');
    }
  }

  private newRow(referencePoint: string, amount: string): FareRow {
    return { key: this.nextRowKey++, referencePoint, amount };
  }
}

function valueOf(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
}

/** `fares[0].amount` y `fares.0.amount` pertenecen al campo `fares`. */
function matchesField(violationField: string, field: string): boolean {
  return violationField === field
    || violationField.startsWith(field + '[')
    || violationField.startsWith(field + '.');
}
