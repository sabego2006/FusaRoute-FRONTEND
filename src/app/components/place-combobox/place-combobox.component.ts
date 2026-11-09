import { Component, ElementRef, computed, effect, input, model, output, signal, viewChild } from '@angular/core';
import { Place, TripEnd } from '../../models/place.model';
import { findExactPlace, normalizeText, rankPlaces } from '../../lib/place-search';

/** Las dos opciones que no son un lugar: van siempre arriba de las sugerencias. */
export type ComboboxAction = 'my-location' | 'map';

export type ComboOption =
  | { kind: 'action'; action: ComboboxAction; label: string; id: string }
  | { kind: 'place'; place: Place; id: string };

let nextId = 0;

/**
 * Campo escribible para una punta del viaje, con el patrón ARIA *combobox* (lista de
 * sugerencias navegable con flechas; Enter elige y Escape cierra).
 *
 * Busca sobre los lugares canónicos que recibe (`places`), sin importar tildes ni
 * mayúsculas, y también por alias. Arriba de las sugerencias ofrece "Mi ubicación"
 * (solo si `offerMyLocation`) y "Elegir en el mapa". Esas dos no las resuelve el
 * componente, solo avisa por `action`: pedir el GPS o abrir el mapa es cosa de la
 * pantalla, que devuelve lo elegido por `value`.
 */
@Component({
  selector: 'app-place-combobox',
  standalone: true,
  template: `
    <label class="fr-etiqueta" [for]="inputId">{{ label() }}</label>
    <div class="combo">
      <input #campo
             [id]="inputId"
             class="fr-input fr-input-buscador"
             type="text"
             role="combobox"
             autocomplete="off"
             autocapitalize="off"
             spellcheck="false"
             aria-autocomplete="list"
             [attr.aria-expanded]="open()"
             [attr.aria-controls]="listId"
             [attr.aria-activedescendant]="activeId()"
             [attr.aria-describedby]="hint() ? hintId : null"
             [placeholder]="placeholder()"
             [value]="text()"
             (input)="onInput($any($event.target).value)"
             (focus)="open.set(true)"
             (click)="open.set(true)"
             (keydown)="onKeydown($event)"
             (blur)="onBlur()" />
      @if (text()) {
        <button type="button" class="combo__limpiar" (mousedown)="$event.preventDefault()"
                (click)="clear()" [attr.aria-label]="'Borrar ' + label().toLowerCase()">
          <span aria-hidden="true">✕</span>
        </button>
      }
      <ul [id]="listId" role="listbox" class="combo__lista" [attr.aria-label]="label()"
          [hidden]="!open() || options().length === 0">
        @for (opt of options(); track opt.id; let i = $index) {
          <li [id]="opt.id"
              role="option"
              class="combo__opcion"
              [class.combo__opcion--accion]="opt.kind === 'action'"
              [class.combo__opcion--activa]="i === active()"
              [attr.aria-selected]="i === active()"
              tabindex="-1"
              (mousedown)="$event.preventDefault()"
              (keydown.enter)="choose(opt)"
              (click)="choose(opt)">
            @if (opt.kind === 'action') {
              {{ opt.label }}
            } @else {
              <span>{{ opt.place.name }}</span>
              @if (matchedAlias(opt.place); as alias) {
                <span class="fr-texto-sm combo__alias">({{ alias }})</span>
              }
            }
          </li>
        }
      </ul>
    </div>
    @if (noMatches()) {
      <p class="fr-texto-sm combo__pista" role="status">
        No encontramos "{{ text() }}". Pruebe con otro nombre o elija en el mapa.
      </p>
    }
    @if (hint()) {
      <p [id]="hintId" class="fr-texto-sm combo__pista" role="status">{{ hint() }}</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .combo { position: relative; }
    .combo > input { width: 100%; padding-right: 44px; }
    /* A 320 px cada pixel cuenta: "Terminal de Transporte" tiene que verse entero. */
    @media (max-width: 399px) {
      .combo > input { padding-left: var(--space-2); letter-spacing: -0.01em; }
    }
    .combo__limpiar {
      position: absolute; right: 0; top: 50%; transform: translateY(-50%);
      min-width: 44px; min-height: 44px;
      background: transparent; border: 0; cursor: pointer;
      color: var(--sobre-lima); font-size: 16px; border-radius: var(--radius-md);
    }
    .combo__limpiar:focus-visible { outline: var(--trazo-2) solid var(--tinta); }
    .combo__lista {
      position: absolute; z-index: 20; left: 0; right: 0; top: calc(100% + var(--space-1));
      margin: 0; padding: var(--space-1) 0; list-style: none;
      background: var(--superficie); color: var(--tinta);
      border: var(--trazo-2) solid var(--borde); border-radius: var(--radius-md);
      box-shadow: var(--sombra-dura-md);
      max-height: min(60vh, 400px); overflow-y: auto;
    }
    .combo__lista[hidden] { display: none; }
    .combo__opcion {
      display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;
      min-height: 44px; padding: var(--space-2) var(--space-3);
      cursor: pointer; overflow-wrap: anywhere;
    }
    .combo__opcion--accion { font-weight: 600; }
    .combo__opcion--accion + .combo__opcion:not(.combo__opcion--accion) {
      border-top: var(--trazo-2) solid var(--borde);
    }
    .combo__opcion--activa, .combo__opcion:hover { background: var(--indigo-suave); }
    .combo__alias { color: var(--tinta-suave); }
    .combo__pista { margin: var(--space-2) 0 0; }
  `],
})
export class PlaceComboboxComponent {
  readonly label = input.required<string>();
  readonly placeholder = input('Escriba un lugar');
  readonly places = input<Place[]>([]);
  readonly offerMyLocation = input(false);
  /** Mensaje bajo el campo: "Buscando su ubicación…", "No pudimos…", etc. */
  readonly hint = input<string | null>(null);
  /** Lo elegido. `null` mientras el texto no corresponda a una elección. */
  readonly value = model<TripEnd | null>(null);
  readonly action = output<ComboboxAction>();

  private readonly uid = ++nextId;
  readonly inputId = `place-combo-${this.uid}`;
  readonly listId = `place-combo-${this.uid}-lista`;
  readonly hintId = `place-combo-${this.uid}-pista`;

  readonly text = signal('');
  readonly open = signal(false);
  readonly active = signal(-1);

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  /** Con algo ya elegido, abrir el campo muestra solo las acciones. */
  readonly suggestions = computed(() => (this.value() ? [] : rankPlaces(this.places(), this.text())));

  readonly noMatches = computed(() =>
    this.open() && !this.value() && this.text().trim().length > 0
    && this.places().length > 0 && this.suggestions().length === 0);

  readonly options = computed<ComboOption[]>(() => {
    const opts: ComboOption[] = [];
    if (this.offerMyLocation()) {
      opts.push({ kind: 'action', action: 'my-location', label: '📍 Mi ubicación', id: `${this.listId}-gps` });
    }
    opts.push({ kind: 'action', action: 'map', label: '🗺️ Elegir en el mapa', id: `${this.listId}-mapa` });
    for (const place of this.suggestions()) {
      opts.push({ kind: 'place', place, id: `${this.listId}-${place.id}` });
    }
    return opts;
  });

  readonly activeId = computed(() => {
    const opt = this.options()[this.active()];
    return this.open() && opt ? opt.id : null;
  });

  constructor() {
    // Si la pantalla fija el valor (GPS, mapa, historial), el texto lo refleja.
    effect(() => {
      const v = this.value();
      if (v) this.text.set(v.label);
    });
  }

  /** Alias con el que casó la búsqueda: explica por qué "monumento" sugiere "Indio". */
  matchedAlias(place: Place): string | null {
    const q = normalizeText(this.text());
    if (!q || normalizeText(place.name).includes(q)) return null;
    return place.aliases.find((a) => normalizeText(a).includes(q)) ?? null;
  }

  onInput(text: string): void {
    this.text.set(text);
    if (this.value()) this.value.set(null);
    this.open.set(true);
    // Con algo escrito, la primera sugerencia queda lista para Enter.
    const firstPlace = this.options().findIndex((o) => o.kind === 'place');
    this.active.set(text.trim() ? firstPlace : -1);
  }

  onKeydown(event: KeyboardEvent): void {
    const n = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) { this.open.set(true); this.active.set(0); return; }
        this.active.set((this.active() + 1) % n);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.open()) { this.open.set(true); this.active.set(n - 1); return; }
        this.active.set((this.active() - 1 + n) % n);
        return;
      case 'Enter': {
        const opt = this.open() ? this.options()[this.active()] : undefined;
        if (opt) {
          // Sin esto, Enter además envía el formulario con la punta a medio elegir.
          event.preventDefault();
          this.choose(opt);
        }
        return;
      }
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.open.set(false);
          this.active.set(-1);
        } else if (this.text()) {
          this.clear();
        }
        return;
      case 'Tab':
        this.open.set(false);
        return;
    }
  }

  onBlur(): void {
    this.open.set(false);
    this.active.set(-1);
    // Quien escribió el nombre completo y siguió de largo, eligió ese lugar.
    if (!this.value()) {
      const exact = findExactPlace(this.places(), this.text());
      if (exact) this.selectPlace(exact);
    }
  }

  choose(opt: ComboOption): void {
    this.open.set(false);
    this.active.set(-1);
    if (opt.kind === 'action') {
      this.action.emit(opt.action);
    } else {
      this.selectPlace(opt.place);
    }
  }

  clear(): void {
    this.text.set('');
    this.value.set(null);
    this.campo().nativeElement.focus();
  }

  private selectPlace(place: Place): void {
    this.value.set({ kind: 'place', place, label: place.name });
    this.text.set(place.name);
  }
}
