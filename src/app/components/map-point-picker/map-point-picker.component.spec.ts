import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MapPointPickerComponent, PickedPoints } from './map-point-picker.component';
import { GoogleMapsLoaderService, MapsStatus } from '../../core/google-maps-loader.service';

function fakeLoader(estadoInicial: MapsStatus = 'cargando') {
  return { status: signal<MapsStatus>(estadoInicial), load: () => new Promise<void>(() => undefined) };
}

// `@angular/google-maps` usa `google.maps.Map`/`google.maps.Marker` directamente cuando
// ya estan definidos (sin pasar por `importLibrary`, que requiere red de verdad) — ver
// GoogleMap#ngOnInit y MapMarker#ngOnInit en el paquete. Con este doble minimo, la rama
// "listo" del template (la que trae <google-map>/<map-marker>) renderiza en jsdom sin
// tener que simular la API completa de Maps ni salir a la red.
class FakeGoogleMap {
  setOptions(): void {}
  setCenter(): void {}
  setZoom(): void {}
  setMapTypeId(): void {}
  addListener(): { remove: () => void } {
    return { remove: () => undefined };
  }
}
class FakeMarker {
  setMap(): void {}
  setOptions(): void {}
  addListener(): { remove: () => void } {
    return { remove: () => undefined };
  }
}

function stubGoogleMaps(): void {
  (window as unknown as { google: unknown }).google = {
    maps: { Map: FakeGoogleMap, Marker: FakeMarker },
  };
}

async function render(estado: MapsStatus) {
  await TestBed.configureTestingModule({
    imports: [MapPointPickerComponent],
    providers: [{ provide: GoogleMapsLoaderService, useValue: fakeLoader(estado) }]
  }).compileComponents();

  const fixture = TestBed.createComponent(MapPointPickerComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('MapPointPickerComponent', () => {
  afterEach(() => {
    delete (window as unknown as { google?: unknown }).google;
  });

  it('mientras carga la API de Maps, muestra un estado de carga en vez de romper', async () => {
    const { el } = await render('cargando');

    expect(el.querySelector('[role="status"]')?.textContent).toContain('Cargando mapa');
    expect(el.querySelector('google-map')).toBeNull();
  });

  it('sin clave de Maps, muestra un aviso y no intenta renderizar el mapa', async () => {
    const { el } = await render('sin-clave');

    expect(el.querySelector('[role="status"]')?.textContent)
      .toContain('Elegir en el mapa no está disponible');
    expect(el.querySelector('google-map')).toBeNull();
  });

  it('si la API de Maps falla, muestra el mismo aviso (la búsqueda por barrio sigue sirviendo)', async () => {
    const { el } = await render('error');

    expect(el.querySelector('[role="status"]')?.textContent)
      .toContain('Elegir en el mapa no está disponible');
    expect(el.querySelector('google-map')).toBeNull();
  });

  // Los siguientes casos ejercen la lógica del componente directamente sobre su
  // instancia. Se renderiza en estado 'sin-clave' a propósito: jsdom no trae el
  // namespace `google`, así que la rama "listo" del template (que incluye
  // <google-map>) explota. Lo que importa aquí es el comportamiento del método,
  // no que Google pinte: el fixture compila igual y la instancia funciona.

  it('un clic sobre el mapa emite el punto en el modo activo', async () => {
    const { component } = await render('sin-clave');
    const emits: PickedPoints[] = [];
    component.pointsChange.subscribe((p) => emits.push(p));

    const latLng = { lat: () => 4.34, lng: () => -74.36 } as google.maps.LatLng;
    component.onMapClick({ latLng } as google.maps.MapMouseEvent);

    expect(emits).toHaveLength(1);
    expect(emits[0].origin).toEqual({ lat: 4.34, lng: -74.36 });
    expect(emits[0].destination).toBeNull();
  });

  it('después de fijar el origen, el próximo clic edita el destino automáticamente', async () => {
    const { component } = await render('sin-clave');
    const emits: PickedPoints[] = [];
    component.pointsChange.subscribe((p) => emits.push(p));

    component.onMapClick({ latLng: { lat: () => 4.34, lng: () => -74.36 } as google.maps.LatLng } as google.maps.MapMouseEvent);
    component.onMapClick({ latLng: { lat: () => 4.33, lng: () => -74.35 } as google.maps.LatLng } as google.maps.MapMouseEvent);

    expect(emits[1].origin).toEqual({ lat: 4.34, lng: -74.36 });
    expect(emits[1].destination).toEqual({ lat: 4.33, lng: -74.35 });
  });

  it('"Quitar" deja el punto en null sin tocar el otro', async () => {
    const { component } = await render('sin-clave');
    const emits: PickedPoints[] = [];
    component.pointsChange.subscribe((p) => emits.push(p));

    component.onMapClick({ latLng: { lat: () => 4.34, lng: () => -74.36 } as google.maps.LatLng } as google.maps.MapMouseEvent);
    component.clear('origin');

    expect(emits.at(-1)?.origin).toBeNull();
    expect(emits.at(-1)?.destination).toBeNull();
  });

  it('un clic sin latLng (dato roto) se ignora en vez de emitir basura', async () => {
    const { component } = await render('sin-clave');
    const emits: PickedPoints[] = [];
    component.pointsChange.subscribe((p) => emits.push(p));

    component.onMapClick({ latLng: null } as unknown as google.maps.MapMouseEvent);

    expect(emits).toHaveLength(0);
  });

  it('con el mapa listo y sin puntos fijados, muestra el selector de modo sin marcadores ni botones de quitar', async () => {
    stubGoogleMaps();
    const { el } = await render('listo');

    expect(el.querySelector('[role="status"]')).toBeNull();
    expect(el.querySelector('google-map')).not.toBeNull();
    expect(el.querySelector('input[value="origin"]')).not.toBeNull();
    expect(el.querySelector('input[value="destination"]')).not.toBeNull();
    expect(el.querySelector('map-marker')).toBeNull();
    expect([...el.querySelectorAll('button')].some((b) => b.textContent?.includes('Quitar'))).toBe(false);
  });

  it('con el mapa listo, los radios de "Origen" y "Destino" cambian el modo activo', async () => {
    stubGoogleMaps();
    const { component, el } = await render('listo');

    el.querySelector<HTMLInputElement>('input[value="destination"]')?.dispatchEvent(new Event('change'));
    expect(component.mode()).toBe('destination');

    el.querySelector<HTMLInputElement>('input[value="origin"]')?.dispatchEvent(new Event('change'));
    expect(component.mode()).toBe('origin');
  });

  it('con el mapa listo y puntos fijados, pinta un marcador por punta y permite quitarlos desde el boton', async () => {
    stubGoogleMaps();
    const { component, fixture, el } = await render('listo');

    component.onMapClick({ latLng: { lat: () => 4.34, lng: () => -74.36 } as google.maps.LatLng } as google.maps.MapMouseEvent);
    component.onMapClick({ latLng: { lat: () => 4.33, lng: () => -74.35 } as google.maps.LatLng } as google.maps.MapMouseEvent);
    fixture.detectChanges();

    expect(el.querySelectorAll('map-marker').length).toBe(2);
    const quitarOrigen = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Quitar origen'));
    expect(quitarOrigen).toBeDefined();

    quitarOrigen?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(component.points().origin).toBeNull();
    expect(component.points().destination).not.toBeNull();

    const quitarDestino = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Quitar destino'));
    quitarDestino?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(component.points().destination).toBeNull();
  });
});
