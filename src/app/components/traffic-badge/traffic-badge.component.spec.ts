import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { TrafficBadgeComponent, TrafficBadgeVariant } from './traffic-badge.component';
import { CongestionSector } from '../../models/route.model';

async function render(sectors: CongestionSector[] | undefined, variant?: TrafficBadgeVariant) {
  await TestBed.configureTestingModule({ imports: [TrafficBadgeComponent] }).compileComponents();
  const fixture = TestBed.createComponent(TrafficBadgeComponent);
  fixture.componentRef.setInput('sectors', sectors);
  if (variant) {
    fixture.componentRef.setInput('variant', variant);
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const dosSectores: CongestionSector[] = [
  { name: 'Centro - Carrera 1', startsAt: '17:00:00', endsAt: '19:00:00' },
  { name: 'La Pampa', startsAt: '06:30:00', endsAt: '08:00:00' }
];

describe('TrafficBadgeComponent', () => {
  it('con sectores, avisa en condicional y lista cada franja sin segundos', async () => {
    const el = await render(dosSectores);

    const aviso = el.querySelector('[role="status"]');
    expect(aviso?.textContent).toContain('Puede haber congestión');

    const items = Array.from(el.querySelectorAll('.congestion-sector'));
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('Centro - Carrera 1 (17:00–19:00)');
    expect(items[1].textContent).toBe('La Pampa (06:30–08:00)');
  });

  it('sin sectores no pinta nada', async () => {
    const el = await render([]);

    expect(el.textContent?.trim()).toBe('');
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it('si el backend no manda el campo, tampoco pinta nada', async () => {
    const el = await render(undefined);

    expect(el.textContent?.trim()).toBe('');
  });

  it('el aviso usa el amarillo de congestión, no el rojo de error', async () => {
    const el = await render(dosSectores);

    const aviso = el.querySelector('.fr-aviso-congestion');
    expect(aviso?.classList.contains('fr-alerta')).toBe(false);
    expect(aviso?.classList.contains('fr-aviso-congestion')).toBe(true);
  });

  it('nunca afirma el trancón: el aviso va siempre en condicional', async () => {
    const el = await render(dosSectores);

    expect(el.textContent).toContain('Puede haber congestión');
    expect(el.textContent).not.toMatch(/\bHay congestión\b/i);
  });

  it('variante compacta: marca la tarjeta sin repetir las franjas horarias', async () => {
    const el = await render(dosSectores, 'compact');

    expect(el.textContent).toContain('Puede haber congestión');
    expect(el.querySelector('.congestion-sector')).toBeNull();
    expect(el.textContent).not.toContain('17:00');
    expect(el.querySelector('[role="status"]')).toBeNull();
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });
});
