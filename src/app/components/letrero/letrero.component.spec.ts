import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { LetreroComponent } from './letrero.component';
import { RouteSign } from '../../models/route.model';

async function render(signs: RouteSign[]): Promise<HTMLElement> {
  await TestBed.configureTestingModule({ imports: [LetreroComponent] }).compileComponents();
  const fixture = TestBed.createComponent(LetreroComponent);
  fixture.componentRef.setInput('signs', signs);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/** Caso real de V11 (SCRUM-176): 'Camino Real - La Pampa' SUBIENDO. */
const subiendo: RouteSign = {
  fieldId: 'LC-008',
  sense: 'SUBIENDO',
  sourcePhoto: '20260927_150814.jpg',
  evidenceCrop: '20260927_150814.jpg',
  observedOn: '2026-09-27',
  plates: [
    {
      template: 'TABLA_FRANJAS',
      code: null,
      lines: [
        { text: 'EXITO', background: '#F0D84A', foreground: '#222222' },
        { text: 'CAMINO REAL', background: '#2F8F6A', foreground: '#E8F5EE' }
      ]
    },
    {
      template: 'PLACA_RECT',
      code: null,
      lines: [{ text: 'INDIO', background: '#BFE0DA', foreground: '#222222' }]
    }
  ]
};

/** Mismo caso real, pero BAJANDO (otra buseta). */
const bajando: RouteSign = {
  ...subiendo,
  fieldId: 'LC-015',
  sense: 'BAJANDO',
  plates: [{ template: 'PLACA_ARCO', code: '100', lines: [{ text: 'LA CLARITA', background: '#EDB03A', foreground: '#1E1E1E' }] }]
};

describe('LetreroComponent', () => {
  it('sin letreros no pinta nada', async () => {
    const el = await render([]);

    expect(el.querySelector('.letrero-grupo')).toBeNull();
    expect(el.textContent?.trim()).toBe('');
  });

  it('pinta el texto de cada línea de cada placa, en orden', async () => {
    const el = await render([subiendo]);

    const lineas = Array.from(el.querySelectorAll('.letrero-linea')).map((n) => n.textContent?.trim());
    expect(lineas).toEqual(['EXITO', 'CAMINO REAL', 'INDIO']);
  });

  it('aplica el color de cada línea tal como lo manda el backend, ya resuelto', async () => {
    const el = await render([subiendo]);

    const primera = el.querySelector('.letrero-linea') as HTMLElement;
    expect(primera.style.background).toBe('rgb(240, 216, 74)');
    expect(primera.style.color).toBe('rgb(34, 34, 34)');
  });

  it('muestra el código de la placa cuando lo trae', async () => {
    const el = await render([bajando]);

    expect(el.querySelector('.letrero-codigo')?.textContent?.trim()).toBe('100');
  });

  it('sin código, no pinta el chip de código', async () => {
    const el = await render([subiendo]);

    expect(el.querySelector('.letrero-codigo')).toBeNull();
  });

  it('muestra el sentido cuando el letrero lo documenta', async () => {
    const el = await render([subiendo, bajando]);

    expect(el.textContent).toContain('Subiendo');
    expect(el.textContent).toContain('Bajando');
  });

  it('sin sentido documentado, no muestra ningún chip de sentido', async () => {
    const sinSentido: RouteSign = { ...subiendo, sense: null };
    const el = await render([sinSentido]);

    expect(el.querySelector('.letrero-sentido')).toBeNull();
  });

  it('da una clase CSS distinta por cada plantilla de placa', async () => {
    const el = await render([subiendo]);

    const placas = el.querySelectorAll('.letrero-placa');
    expect(placas[0].classList.contains('letrero-placa--tabla-franjas')).toBe(true);
    expect(placas[1].classList.contains('letrero-placa--placa-rect')).toBe(true);
  });

  it('pinta varios letreros de la misma ruta, uno por cada evidencia de campo', async () => {
    const el = await render([subiendo, bajando]);

    expect(el.querySelectorAll('.letrero')).toHaveLength(2);
  });
});
