import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { MapPickDialogComponent } from './map-pick-dialog.component';
import { GoogleMapsLoaderService } from '../../core/google-maps-loader.service';

async function render(status: string) {
  await TestBed.configureTestingModule({
    imports: [MapPickDialogComponent],
    providers: [{ provide: GoogleMapsLoaderService, useValue: { status: signal(status), load: () => Promise.reject(new Error('x')) } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(MapPickDialogComponent);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('MapPickDialogComponent', () => {
  it('se abre para una punta y avisa si el mapa no está disponible', async () => {
    const { c, el, fixture } = await render('sin-clave');
    c.open('destination');
    fixture.detectChanges();
    expect(el.querySelector('dialog')!.hasAttribute('open')).toBe(true);
    expect(el.textContent).toContain('Elija a dónde va');
    expect(el.textContent).toContain('no está disponible');
  });

  it('un toque fija el punto y confirmar lo emite y cierra', async () => {
    const { c, el, fixture } = await render('cargando');
    const emitted: unknown[] = [];
    c.picked.subscribe((e) => emitted.push(e));
    c.open('origin');
    fixture.detectChanges();
    expect(el.textContent).toContain('Elija de dónde sale');
    const usar = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Usar'))!;
    expect(usar().disabled).toBe(true);
    c.onMapClick({ latLng: { lat: () => 4.3, lng: () => -74.3 } } as unknown as google.maps.MapMouseEvent);
    c.onMapClick({ latLng: null } as google.maps.MapMouseEvent);
    fixture.detectChanges();
    expect(usar().disabled).toBe(false);
    usar().click();
    expect(emitted).toEqual([{ which: 'origin', point: { lat: 4.3, lng: -74.3 } }]);
    expect(el.querySelector('dialog')!.hasAttribute('open')).toBe(false);
  });

  it('cancelar cierra sin emitir', async () => {
    const { c, el } = await render('error');
    const emitted: unknown[] = [];
    c.picked.subscribe((e) => emitted.push(e));
    c.open('origin', { lat: 1, lng: 2 });
    c.confirm();
    expect(emitted).toHaveLength(1);
    c.open('origin');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Cancelar'))!.click();
    expect(emitted).toHaveLength(1);
  });
});
