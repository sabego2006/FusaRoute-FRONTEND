import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { FareTableComponent } from './fare-table.component';
import { Fare, RouteType } from '../../models/route.model';

async function render(fares: Fare[], type: RouteType, lastUpdatedAt: string | null = null) {
  await TestBed.configureTestingModule({ imports: [FareTableComponent] }).compileComponents();
  const fixture = TestBed.createComponent(FareTableComponent);
  fixture.componentRef.setInput('fares', fares);
  fixture.componentRef.setInput('type', type);
  fixture.componentRef.setInput('lastUpdatedAt', lastUpdatedAt);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('FareTableComponent', () => {
  it('urbana: muestra un único precio y su fecha', async () => {
    const el = await render([{ referencePoint: null, amount: 2600, validFrom: '2026-02-05' }], 'URBANA', '2026-02-05');

    expect(el.textContent).toMatch(/\$\s?2\.600/);
    expect(el.textContent).toContain('precio único');
    expect(el.textContent).toContain('5 de febrero de 2026');
    expect(el.querySelector('table')).toBeNull();
  });

  it('intermunicipal: muestra la tabla por punto de referencia, en el orden que llega, sin reordenar', async () => {
    const el = await render(
      [
        { referencePoint: 'Corregimiento', amount: 3000, validFrom: '2025-01-16' },
        { referencePoint: 'Alaska', amount: 3550, validFrom: '2026-02-05' },
        { referencePoint: 'Pasca', amount: 4300, validFrom: '2025-01-16' }
      ],
      'INTERMUNICIPAL',
      '2026-02-05'
    );

    const rows = Array.from(el.querySelectorAll('tbody tr')).map((r) => r.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Corregimiento');
    expect(rows[1]).toContain('Alaska');
    expect(rows[2]).toContain('Pasca');
    expect(rows[1]).toContain('5 de febrero de 2026');
    expect(rows[2]).toContain('16 de enero de 2025');

    const seccion = el.textContent ?? '';
    expect(seccion).toContain('Última actualización');
    expect(seccion).toContain('5 de febrero de 2026');
  });

  it('sin tarifas: lo dice en vez de mostrar un precio vacío', async () => {
    const el = await render([], 'URBANA');

    expect(el.textContent).toContain('Tarifa no disponible por ahora.');
  });

  it('sin lastUpdatedAt (opcional): no muestra la línea ni se rompe', async () => {
    const el = await render([{ referencePoint: null, amount: 2600, validFrom: '2026-02-05' }], 'URBANA');

    expect(el.textContent).not.toContain('Actualizada el');
    expect(el.textContent).toMatch(/\$\s?2\.600/);
  });
});
