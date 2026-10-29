import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { throwError, of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { RoutesDetailComponent } from './routes-detail.component';
import { RouteService } from '../../../services/route.service';
import { GoogleMapsLoaderService } from '../../../core/google-maps-loader.service';
import { RouteDetail, RouteSign } from '../../../models/route.model';

async function render(getRouteById: () => unknown, id: string | null = '1') {
  await TestBed.configureTestingModule({
    imports: [RoutesDetailComponent],
    providers: [
      provideRouter([]),
      { provide: RouteService, useValue: { getRouteById } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      // El mapa no debe salir a la red en los tests: se simula que la API de Google
      // nunca termina de cargar, que es el estado en el que el componente muestra
      // "Cargando mapa..." y no intenta dibujar nada.
      { provide: GoogleMapsLoaderService, useValue: { load: () => new Promise<void>(() => undefined) } }
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(RoutesDetailComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/** Hoy la mayoría de las rutas sembradas no tiene trazado: `path` llega en null. */
const urbana: RouteDetail = {
  id: 1,
  name: 'Camino Real - La Pampa',
  type: 'URBANA',
  neighborhoods: ['Camino Real', 'Centro', 'La Pampa'],
  fares: [{ referencePoint: null, amount: 2600, validFrom: '2026-02-05' }],
  path: null,
  congestionSectors: [],
  signs: []
};

/** Caso real de V11 (SCRUM-176): un letrero con dos placas, en el sentido SUBIENDO. */
const letreroSubiendo: RouteSign = {
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
        { text: 'CAMINO REAL', background: '#2F8F6A', foreground: '#E8F5EE' },
        { text: 'CALLE 22', background: '#BFE0DA', foreground: '#222222' }
      ]
    }
  ]
};

const urbanaConTrazado: RouteDetail = {
  ...urbana,
  // GeoJSON: [longitud, latitud], en ese orden.
  path: {
    type: 'LineString',
    coordinates: [
      [-74.3661, 4.3433],
      [-74.36, 4.33]
    ]
  }
};

const intermunicipal: RouteDetail = {
  id: 8,
  name: 'Fusagasugá - Pasca',
  type: 'INTERMUNICIPAL',
  neighborhoods: Array.from({ length: 9 }, (_, i) => `Barrio ${i + 1}`),
  fares: [
    { referencePoint: 'Corregimiento', amount: 3000, validFrom: '2025-01-16' },
    { referencePoint: 'Alaska', amount: 3550, validFrom: '2026-02-05' },
    { referencePoint: 'Pasca', amount: 4300, validFrom: '2025-01-16' }
  ],
  path: null,
  congestionSectors: [],
  // Caso real (V11): ningún letrero fotografiado respalda esta ruta todavía.
  signs: []
};

describe('RoutesDetailComponent', () => {
  it('ruta urbana: muestra sus barrios en orden y un único precio con su fecha', async () => {
    const el = await render(() => of(urbana));

    expect(el.querySelector('h1')?.textContent).toContain('Camino Real - La Pampa');
    expect(Array.from(el.querySelectorAll('.barrio')).map((n) => n.textContent?.trim())).toEqual([
      'Camino Real',
      'Centro',
      'La Pampa'
    ]);
    expect(el.textContent).toMatch(/\$\s?2\.600/);
    expect(el.textContent).toContain('5 de febrero de 2026');
    expect(el.querySelector('table')).toBeNull();
  });

  it('ruta intermunicipal: muestra la tabla por punto de referencia, en el orden que llega', async () => {
    const el = await render(() => of(intermunicipal), '8');

    const rows = Array.from(el.querySelectorAll('tbody tr')).map((r) => r.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Corregimiento');
    expect(rows[1]).toContain('Alaska');
    expect(rows[2]).toContain('Pasca');
    expect(rows[1]).toContain('5 de febrero de 2026');
    expect(rows[2]).toContain('16 de enero de 2025');
  });

  it('con más de 7 barrios muestra solo 7, con el primero y el último', async () => {
    const el = await render(() => of(intermunicipal), '8');

    const steps = Array.from(el.querySelectorAll('.barrio')).map((n) => n.textContent?.trim());
    expect(steps).toHaveLength(7);
    expect(steps[0]).toBe('Barrio 1');
    expect(steps[6]).toBe('Barrio 9');
  });

  it('ruta sin tarifa vigente: lo dice en vez de mostrar un precio vacío', async () => {
    const el = await render(() => of({ ...urbana, fares: [] }));

    expect(el.textContent).toContain('Tarifa no disponible');
  });

  it('404 (no existe o está suspendida): mensaje claro y sin detalle', async () => {
    const el = await render(() => throwError(() => new HttpErrorResponse({ status: 404 })), '999');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no existe o no está disponible');
    expect(el.querySelector('article')).toBeNull();
  });

  it('otro error: mensaje genérico de carga', async () => {
    const el = await render(() => throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar');
  });

  it('con trazado cargado, monta el mapa del recorrido', async () => {
    const el = await render(() => of(urbanaConTrazado));

    expect(el.querySelector('app-map-view')).not.toBeNull();
    expect(el.textContent).toContain('Recorrido en el mapa');
    expect(el.textContent).not.toContain('todavía no tiene su recorrido dibujado');
  });

  it('sin trazado, lo dice en vez de dejar un hueco donde iría el mapa', async () => {
    // El trazado de la mayoría de las rutas sigue sin dibujarse (SCRUM-166). La
    // pantalla tiene que seguir siendo útil: barrios y tarifas se muestran igual.
    const el = await render(() => of(urbana));

    expect(el.querySelector('app-map-view')).toBeNull();
    expect(el.textContent).toContain('todavía no tiene su recorrido dibujado');
    expect(el.textContent).toContain('Camino Real');
  });

  it('con sectores en trancón, avisa que puede haber congestión y da la franja sin segundos', async () => {
    const el = await render(() =>
      of({
        ...urbana,
        congestionSectors: [{ name: 'Centro - Carrera 1', startsAt: '17:00:00', endsAt: '19:00:00' }]
      })
    );

    const aviso = el.querySelector('[role="status"]');
    expect(aviso?.textContent).toContain('Puede haber congestión');
    expect(el.querySelector('.congestion-sector')?.textContent).toContain('Centro - Carrera 1 (17:00–19:00)');
  });

  it('sin sectores en trancón, no muestra ningún aviso', async () => {
    const el = await render(() => of(urbana));

    expect(el.textContent).not.toContain('Puede haber congestión');
    expect(el.querySelector('.congestion-sector')).toBeNull();
  });

  it('si el backend no manda la clave (build viejo), no muestra aviso ni se rompe', async () => {
    const { congestionSectors: _omitida, ...sinClave } = urbana;
    const el = await render(() => of(sinClave));

    expect(el.querySelector('h1')?.textContent).toContain('Camino Real - La Pampa');
    expect(el.textContent).not.toContain('Puede haber congestión');
  });

  it('con letrero fotografiado, muestra la sección y el texto de la placa (SCRUM-176)', async () => {
    const el = await render(() => of({ ...urbana, signs: [letreroSubiendo] }));

    expect(el.textContent).toContain('Letrero de la buseta');
    expect(el.querySelector('app-letrero')).not.toBeNull();
    expect(el.textContent).toContain('Subiendo');
    expect(el.textContent).toContain('CAMINO REAL');
  });

  it('sin evidencia de campo, no muestra la sección del letrero', async () => {
    // Es el caso real de 'Fusagasugá - Pasca' (V11): ningún letrero la respalda.
    const el = await render(() => of(intermunicipal), '8');

    expect(el.textContent).not.toContain('Letrero de la buseta');
    expect(el.querySelector('app-letrero')).toBeNull();
  });

  it('si el backend no manda la clave "signs" (build viejo), no muestra letrero ni se rompe', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se destruye solo para omitir la clave
    const { signs: _omitida, ...sinClave } = urbana;
    const el = await render(() => of(sinClave));

    expect(el.querySelector('h1')?.textContent).toContain('Camino Real - La Pampa');
    expect(el.textContent).not.toContain('Letrero de la buseta');
  });
});
