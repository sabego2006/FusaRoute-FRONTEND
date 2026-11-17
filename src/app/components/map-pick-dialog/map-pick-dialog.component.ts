import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../core/google-maps-loader.service';
import { LatLngPoint } from '../map-view/map-view.component';
import { FUSA_CENTER } from '../places-map/places-map.component';

/**
 * Panel modal para "Señalar en el mapa". Se abre para UNA punta: un toque fija el punto,
 * "Listo" lo confirma y el panel se cierra. En el móvil ocupa toda la pantalla (T16).
 * Es un `<dialog>` nativo: atrapa el foco, cierra con Escape y el lector de pantalla lo
 * anuncia como diálogo sin código extra.
 *
 * Causa raíz del "toco y no pasa nada" (SCRUM-195, medida en PROD): `<google-map>` recibía
 * `height="min(55vh, 420px)"`. @angular/google-maps solo agrega "px" a lo que no termina en
 * letras; como esa cadena termina en ")" la convertía en "min(55vh, 420px)px", el navegador
 * descartaba el valor y el mapa quedaba de 0 px de alto: no había nada que tocar. La altura
 * ahora la da el CSS de la caja (`.dlg__mapa`) y el componente recibe "100%".
 *
 * Teclado y lector de pantalla: Google no ofrece "clic" por teclado, así que con el mapa
 * enfocado se mueve con las flechas y Intro marca el centro. Y escribir el lugar en el campo
 * sigue siendo siempre un camino que no necesita el mapa.
 */
@Component({
  selector: 'app-map-pick-dialog',
  standalone: true,
  imports: [GoogleMap, MapMarker],
  template: `
    <dialog #dialogo class="dlg" aria-labelledby="dlg-titulo" (close)="onClosed()" (cancel)="onClosed()">
      <div class="dlg__cuerpo">
        <h2 id="dlg-titulo" class="fr-titulo-3" style="margin: 0;">{{ title() }}</h2>
        @if (notConfigured() || loadError()) {
          <p class="fr-texto" role="status">
            El mapa no está disponible ahora. Cierre esta ventana y escriba el lugar en el campo.
          </p>
        } @else if (!mapsReady()) {
          <p role="status" class="fr-solo-lectores">Cargando mapa...</p>
          <div class="fr-esqueleto dlg__mapa" aria-hidden="true"></div>
        } @else {
          <p class="fr-texto" style="margin: 0;">{{ instruction() }}</p>
          @if (reference()) {
            <p class="fr-texto-sm" style="margin: 0;">{{ referenceNote() }}</p>
          }
          <div class="dlg__mapa" role="group" aria-label="Mapa" aria-describedby="dlg-teclado"
               (keydown.enter)="pickCenter($event)">
            <google-map height="100%" width="100%" [center]="startCenter()" [zoom]="14"
                        [options]="mapOptions" (mapClick)="onMapClick($event)">
              @if (reference(); as r) {
                <map-marker [position]="r" [label]="referenceLabel()" [title]="referenceTitle()" />
              }
              @if (point(); as p) {
                <map-marker [position]="p" title="Punto elegido" />
              }
            </google-map>
          </div>
          <p id="dlg-teclado" class="fr-solo-lectores">
            Con el teclado: mueva el mapa con las flechas y presione Intro para marcar el centro.
          </p>
          @if (point()) {
            <p role="status" class="fr-solo-lectores">Punto marcado. Toque el botón Listo para confirmarlo.</p>
          }
        }
        <div class="dlg__acciones">
          <button type="button" class="fr-btn fr-btn-primario" [disabled]="!point()" (click)="confirm()">
            {{ doneLabel() }}
          </button>
          <button type="button" class="fr-btn" (click)="close()">Cancelar</button>
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
    .dlg__cuerpo { display: flex; flex-direction: column; padding: var(--space-4); gap: var(--space-3); box-sizing: border-box; }
    /* La altura la da esta caja, no un atributo de <google-map> (ver la causa raíz arriba). */
    .dlg__mapa { position: relative; height: min(55vh, 420px); width: 100%; border-radius: var(--radius-md); overflow: hidden; }
    .dlg__mapa google-map { display: block; position: absolute; inset: 0; }
    .dlg__acciones { display: flex; flex-direction: column; gap: var(--space-3); }
    .dlg__acciones > .fr-btn { width: 100%; min-height: 48px; box-sizing: border-box; }
    /* En el móvil el panel es la pantalla entera: el mapa se lleva todo el espacio sobrante. */
    @media (max-width: 640px) {
      .dlg { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; border: 0; border-radius: 0; }
      .dlg[open] { display: flex; flex-direction: column; }
      .dlg__cuerpo {
        flex: 1 1 auto; min-height: 0;
        padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
      }
      .dlg__mapa { flex: 1 1 auto; height: auto; min-height: 240px; }
    }
  `],
})
export class MapPickDialogComponent {
  readonly picked = output<{ which: 'origin' | 'destination'; point: LatLngPoint }>();

  readonly forWhich = signal<'origin' | 'destination'>('origin');
  readonly point = signal<LatLngPoint | null>(null);
  /** La otra punta del viaje, si ya está elegida: se dibuja en el mapa para que uno se ubique. */
  readonly reference = signal<LatLngPoint | null>(null);
  readonly referenceLabel = computed(() => (this.forWhich() === 'origin' ? 'B' : 'A'));
  readonly referenceTitle = computed(() => (this.forWhich() === 'origin' ? 'Su destino' : 'Su origen'));
  readonly referenceNote = computed(() =>
    `La letra ${this.referenceLabel()} marca ${this.forWhich() === 'origin' ? 'a dónde va' : 'de dónde sale'}.`);
  /** El mapa abre donde está lo que ya se eligió, para no empezar desde cero. */
  readonly startCenter = computed(() => this.point() ?? this.reference() ?? FUSA_CENTER);
  readonly title = computed(() => (this.forWhich() === 'origin' ? 'Señale de dónde sale' : 'Señale a dónde va'));
  readonly instruction = computed(() =>
    `Toque el mapa en el sitio donde quiere ${this.forWhich() === 'origin' ? 'salir' : 'llegar'}.`);
  readonly doneLabel = computed(() => (this.forWhich() === 'origin' ? 'Listo, salir de aquí' : 'Listo, ir aquí'));

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly map = viewChild(GoogleMap);
  private readonly loader = inject(GoogleMapsLoaderService);
  protected readonly notConfigured = computed(() => this.loader.status() === 'sin-clave');
  protected readonly loadError = computed(() => this.loader.status() === 'error');
  protected readonly mapsReady = computed(() => this.loader.status() === 'listo');
  protected readonly center = FUSA_CENTER;
  protected readonly mapOptions: google.maps.MapOptions = { disableDefaultUI: true, clickableIcons: false, zoomControl: true };

  /** A quién devolverle el foco al cerrar: el botón desde el que se abrió. */
  private returnFocus: HTMLElement | null = null;

  open(which: 'origin' | 'destination', start: LatLngPoint | null = null, reference: LatLngPoint | null = null): void {
    this.forWhich.set(which);
    this.point.set(start);
    this.reference.set(reference);
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

  /** Camino por teclado: Intro con el mapa enfocado marca el centro que se está viendo. */
  pickCenter(event?: Event): void {
    const c = this.map()?.getCenter();
    if (!c) return;
    event?.preventDefault();
    this.point.set({ lat: c.lat(), lng: c.lng() });
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
