import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { PlacesMapComponent, FUSA_CENTER } from './places-map.component';
import { GoogleMapsLoaderService } from '../../core/google-maps-loader.service';

async function render(status: string) {
  await TestBed.configureTestingModule({
    imports: [PlacesMapComponent],
    providers: [{ provide: GoogleMapsLoaderService, useValue: { status: signal(status), load: vi.fn(() => Promise.reject(new Error('x'))) } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(PlacesMapComponent);
  return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

const a = { position: { lat: 4.33, lng: -74.37 }, title: 'Origen: Indio', label: 'A' };
const b = { position: { lat: 4.34, lng: -74.38 }, title: 'Destino: Terminal', label: 'B' };

function fakeMap() {
  const features: unknown[] = [];
  const LatLngBounds = vi.fn(function (this: { extend: unknown }) { this.extend = vi.fn(); });
  (globalThis as unknown as { google: unknown }).google = { maps: { LatLngBounds } };
  return {
    features,
    map: {
      data: {
        forEach: (fn: (f: unknown) => void) => [...features].forEach(fn),
        remove: (f: unknown) => features.splice(features.indexOf(f), 1),
        addGeoJson: (g: unknown) => features.push(g),
        setStyle: vi.fn(),
      },
      fitBounds: vi.fn(),
      setCenter: vi.fn(),
      setZoom: vi.fn(),
    },
  };
}

describe('PlacesMapComponent', () => {
  it('sin clave muestra el aviso y la leyenda de los puntos', async () => {
    const { fixture, el } = await render('sin-clave');
    fixture.componentRef.setInput('markers', [a, b]);
    fixture.componentRef.setInput('fallbackText', 'Igual puede buscar.');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="mapa-no-disponible"]')?.textContent).toContain('Igual puede buscar.');
    expect(el.textContent).toContain('Origen: Indio');
    expect(el.textContent).toContain('Destino: Terminal');
  });

  it('mientras carga deja un esqueleto del alto pedido', async () => {
    const { fixture, el, c } = await render('cargando');
    fixture.componentRef.setInput('height', 200);
    fixture.detectChanges();
    expect(el.querySelector<HTMLElement>('.hueco')!.style.height).toBe('200px');
    expect(c.center()).toEqual(FUSA_CENTER);
  });

  it('con varios puntos y trazado encuadra todo; con uno centra', async () => {
    const { fixture, c } = await render('cargando');
    const { map, features } = fakeMap();
    fixture.componentRef.setInput('markers', [a, b]);
    fixture.componentRef.setInput('path', { type: 'LineString', coordinates: [[-74.37, 4.33], [-74.38, 4.34]] });
    c.onMapInitialized(map as unknown as google.maps.Map);
    fixture.detectChanges();
    expect(map.fitBounds).toHaveBeenCalled();
    expect(features).toHaveLength(1);

    fixture.componentRef.setInput('markers', [a]);
    fixture.componentRef.setInput('path', null);
    fixture.detectChanges();
    expect(features).toHaveLength(0);
    expect(map.setCenter).toHaveBeenCalledWith(a.position);
    fixture.destroy();
  });
});
