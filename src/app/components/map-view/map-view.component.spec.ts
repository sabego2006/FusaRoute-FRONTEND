import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, afterEach } from 'vitest';
import { MapViewComponent } from './map-view.component';
import { GoogleMapsLoaderService, MapsStatus } from '../../core/google-maps-loader.service';

const path = { type: 'LineString' as const, coordinates: [[-74.36, 4.34], [-74.35, 4.33]] as [number, number][] };
const origin = { lat: 4.34, lng: -74.36 };
const destination = { lat: 4.33, lng: -74.35 };

/** Un `GoogleMapsLoaderService` falso: arranca en el estado dado y nunca ejecuta red de verdad. */
function fakeLoader(estadoInicial: MapsStatus = 'cargando') {
  return { status: signal<MapsStatus>(estadoInicial), load: () => new Promise<void>(() => undefined) };
}

async function render(loader: ReturnType<typeof fakeLoader>) {
  await TestBed.configureTestingModule({
    imports: [MapViewComponent],
    providers: [{ provide: GoogleMapsLoaderService, useValue: loader }]
  }).compileComponents();

  const fixture = TestBed.createComponent(MapViewComponent);
  fixture.componentRef.setInput('path', path);
  fixture.componentRef.setInput('origin', origin);
  fixture.componentRef.setInput('destination', destination);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('MapViewComponent', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--muni-fusagasuga');
  });

  it('mientras carga la API de Maps, muestra un estado de carga en vez de romper', async () => {
    const { el } = await render(fakeLoader('cargando'));

    expect(el.querySelector('[role="status"]')?.textContent).toContain('Cargando mapa');
    expect(el.querySelector('google-map')).toBeNull();
  });

  it('si la API de Maps falla al cargar, lo dice en vez de quedar en blanco', async () => {
    const { el } = await render(fakeLoader('error'));

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar el mapa');
  });

  it('sin clave de Maps configurada, lo dice sin usar el rol de error', async () => {
    const { el } = await render(fakeLoader('sin-clave'));

    expect(el.querySelector('[role="status"]')?.textContent).toContain('no está configurado');
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelector('google-map')).toBeNull();
  });

  it('arma la feature GeoJSON a partir de "path" sin inventar ni transformar coordenadas', async () => {
    const { fixture } = await render(fakeLoader('cargando'));

    expect(fixture.componentInstance.buildPathFeature()).toEqual({
      type: 'Feature',
      properties: {},
      geometry: path
    });
  });

  it('resuelve el token --muni-* del design system a su valor real, no al nombre del token', async () => {
    document.documentElement.style.setProperty('--muni-fusagasuga', '#4F46E5');
    const { fixture } = await render(fakeLoader('cargando'));

    expect(fixture.componentInstance.resolveAccentColor()).toBe('#4F46E5');
  });

  it('con un token sin valor, cae a un color por defecto en vez de pintar vacío', async () => {
    const { fixture } = await render(fakeLoader('cargando'));
    fixture.componentRef.setInput('accentColorToken', '--token-inexistente');

    expect(fixture.componentInstance.resolveAccentColor()).toBe('#4F46E5');
  });
});
