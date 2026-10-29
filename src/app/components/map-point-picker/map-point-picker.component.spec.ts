import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { MapPointPickerComponent, PickedPoints } from './map-point-picker.component';
import { GoogleMapsLoaderService, MapsStatus } from '../../core/google-maps-loader.service';

function fakeLoader(estadoInicial: MapsStatus = 'cargando') {
  return { status: signal<MapsStatus>(estadoInicial), load: () => new Promise<void>(() => undefined) };
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
});
