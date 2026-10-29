import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RouteStepsComponent } from './route-steps.component';

/** Devuelve los nombres de barrio pintados, en orden, tal como los ve el usuario. */
async function render(neighborhoods: string[]): Promise<(string | undefined)[]> {
  await TestBed.configureTestingModule({ imports: [RouteStepsComponent] }).compileComponents();
  const fixture = TestBed.createComponent(RouteStepsComponent);
  fixture.componentRef.setInput('neighborhoods', neighborhoods);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return Array.from(el.querySelectorAll('.barrio')).map((n) => n.textContent?.trim());
}

describe('RouteStepsComponent', () => {
  it('con 7 barrios o menos los muestra todos, en orden y numerados', async () => {
    await TestBed.configureTestingModule({ imports: [RouteStepsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(RouteStepsComponent);
    fixture.componentRef.setInput('neighborhoods', ['Centro', 'La Pampa', 'Balmoral']);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(Array.from(el.querySelectorAll('.barrio')).map((n) => n.textContent?.trim())).toEqual([
      'Centro',
      'La Pampa',
      'Balmoral'
    ]);
    // Los pasos van numerados desde 1 en el chip.
    expect(Array.from(el.querySelectorAll('.fr-chip-lugar')).map((n) => n.textContent?.trim())).toEqual([
      '1',
      '2',
      '3'
    ]);
  });

  it('con más de 7 barrios muestra solo 7, con el primero y el último', async () => {
    const barrios = Array.from({ length: 12 }, (_, i) => `Barrio ${i + 1}`);
    const steps = await render(barrios);
    expect(steps).toHaveLength(7);
    expect(steps[0]).toBe('Barrio 1');
    expect(steps[6]).toBe('Barrio 12');
  });

  it('lista vacía: no pinta ningún paso', async () => {
    const steps = await render([]);
    expect(steps).toHaveLength(0);
  });

  it('preserva el orden de recorrido, no alfabetiza', async () => {
    const steps = await render(['Potosí', 'Centro', 'Balmoral']);
    expect(steps).toEqual(['Potosí', 'Centro', 'Balmoral']);
  });
});
