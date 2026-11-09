import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../core/google-maps-loader.service';
import { LatLngPoint } from '../map-view/map-view.component';
import { FUSA_CENTER } from '../places-map/places-map.component';

/**
 * Panel modal para "Elegir en el mapa" (reemplaza al `<details>` y al selector de dos
 * modos que había antes). Se abre para UNA punta: un toque fija el punto, "Usar este
 * punto" lo confirma y el panel se cierra. Es un `<dialog>` nativo: atrapa el foco,
 * cierra con Escape y el lector de pantalla lo anuncia como diálogo sin código extra.
 */
@Component({
  selector: 'app-map-pick-dialog',
  standalone: true,
  imports: [GoogleMap, MapMarker],
  template: `
    <dialog #dialogo class="dlg" aria-labelledby="dlg-titulo" (close)="onClosed()" (cancel)="onClosed()">
      <div class="dlg__cuerpo fr-pila">
        <h2 id="dlg-titulo" class="fr-titulo-3" style="margin: 0;">{{ title() }}</h2>
        @if (notConfigured() || loadError()) {
          <p class="fr-texto-sm" role="status">
            Elegir en el mapa no está disponible ahora. Escriba el nombre del lugar en el campo.
          </p>
        } @else if (!mapsReady()) {
          <p role="status" class="fr-solo-lectores">Cargando mapa...</p>
          <div class="fr-esqueleto dlg__mapa" aria-hidden="true"></div>
        } @else {
          <p class="fr-texto-sm" style="margin: 0;">Toque el mapa donde quiere {{ forWhich() === 'origin' ? 'salir' : 'llegar' }}.</p>
          <google-map height="min(55vh, 420px)" width="100%" [center]="center" [zoom]="14"
                      [options]="mapOptions" (mapClick)="onMapClick($event)">
            @if (point(); as p) {
              <map-marker [position]="p" title="Punto elegido" />
            }
          </google-map>
        }
        <div class="dlg__acciones">
          <button type="button" class="fr-btn" (click)="close()">Cancelar</button>
          <button type="button" class="fr-btn fr-btn-primario" [disabled]="!point()" (click)="confirm()">
            Usar este punto
          </button>
        </div>
      </div>
    </dialog>
  `,
  styles: [`
    .dlg {
      width: min(560px, calc(100vw - 2 * var(--space-4)));
      max-width: none; padding: 0; box-sizing: border-box;
      border: var(--trazo-2) solid var(--borde); border-radius: var(--radius-lg);
      background: var(--superficie); color: var(--tinta);
    }
    .dlg::backdrop { background: rgb(0 0 0 / 0.5); }
    .dlg__cuerpo { padding: var(--space-4); gap: var(--space-3); }
    .dlg__mapa { height: min(55vh, 420px); width: 100%; border-radius: var(--radius-md); }
    .dlg__acciones { display: flex; flex-wrap: wrap; gap: var(--space-3); justify-content: flex-end; }
    .dlg__acciones > .fr-btn { flex: 1 1 140px; }
  `],
})
export class MapPickDialogComponent {
  readonly picked = output<{ which: 'origin' | 'destination'; point: LatLngPoint }>();

  readonly forWhich = signal<'origin' | 'destination'>('origin');
  readonly point = signal<LatLngPoint | null>(null);
  readonly title = computed(() => (this.forWhich() === 'origin' ? 'Elija de dónde sale' : 'Elija a dónde va'));

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly loader = inject(GoogleMapsLoaderService);
  protected readonly notConfigured = computed(() => this.loader.status() === 'sin-clave');
  protected readonly loadError = computed(() => this.loader.status() === 'error');
  protected readonly mapsReady = computed(() => this.loader.status() === 'listo');
  protected readonly center = FUSA_CENTER;
  protected readonly mapOptions: google.maps.MapOptions = { disableDefaultUI: true, clickableIcons: false, zoomControl: true };

  /** A quién devolverle el foco al cerrar: el campo desde el que se abrió. */
  private returnFocus: HTMLElement | null = null;

  open(which: 'origin' | 'destination', start: LatLngPoint | null = null): void {
    this.forWhich.set(which);
    this.point.set(start);
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.loader.load().catch(() => undefined);
    const d = this.dialogo().nativeElement;
    // jsdom no implementa showModal; en las pruebas basta con el atributo.
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }

  onMapClick(event: google.maps.MapMouseEvent): void {
    const ll = event.latLng;
    if (ll) this.point.set({ lat: ll.lat(), lng: ll.lng() });
  }

  confirm(): void {
    const p = this.point();
    if (!p) return;
    this.picked.emit({ which: this.forWhich(), point: p });
    this.close();
  }

  close(): void {
    const d = this.dialogo().nativeElement;
    if (typeof d.close === 'function') d.close();
    else d.removeAttribute('open');
    this.onClosed();
  }

  onClosed(): void {
    this.returnFocus?.focus?.();
    this.returnFocus = null;
  }
}
