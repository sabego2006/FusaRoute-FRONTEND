import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Subject, throwError, of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { RoutesListComponent } from './routes-list.component';
import { RouteService } from '../../../services/route.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { Route } from '../../../models/route.model';

interface Opciones {
  online?: boolean;
  /** Emite cuando "vuelve la red"; por defecto no vuelve nunca. */
  vuelveLaRed?: Subject<void>;
}

async function renderFixture(getAllPublicRoutes: () => unknown, o: Opciones = {}) {
  const vuelve = o.vuelveLaRed ?? new Subject<void>();
  await TestBed.configureTestingModule({
    imports: [RoutesListComponent],
    providers: [
      provideRouter([]),
      { provide: RouteService, useValue: { getAllPublicRoutes } },
      { provide: ConnectivityService, useValue: {
        isOnline: signal(o.online ?? true),
        whenOnlineAgain: () => vuelve.asObservable(),
      } },
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(RoutesListComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function render(getAllPublicRoutes: () => unknown, o: Opciones = {}) {
  return (await renderFixture(getAllPublicRoutes, o)).nativeElement as HTMLElement;
}

const routes: Route[] = [
  {
    id: 4,
    name: 'Camino Real - La Pampa',
    type: 'URBANA',
    neighborhoods: ['Camino Real', 'La Pampa'],
    fares: [{ referencePoint: null, amount: 2600, validFrom: '2026-02-05' }]
  },
  {
    id: 8,
    name: 'Fusagasugá - Pasca',
    type: 'INTERMUNICIPAL',
    neighborhoods: ['Fusagasugá', 'Pasca'],
    fares: [
      { referencePoint: 'Corregimiento', amount: 3000, validFrom: '2025-01-16' },
      { referencePoint: 'Pasca', amount: 4300, validFrom: '2025-01-16' }
    ]
  }
];

describe('RoutesListComponent', () => {
  it('lista las rutas que devuelve el backend, cada una enlazada a su detalle', async () => {
    const el = await render(() => of(routes));

    const cards = Array.from(el.querySelectorAll('li'));
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Camino Real - La Pampa');
    expect(cards[0].querySelector('a')?.getAttribute('href')).toBe('/rutas/4');
    expect(cards[1].querySelector('a')?.getAttribute('href')).toBe('/rutas/8');
  });

  it('urbana muestra su precio único; intermunicipal, el más bajo con "Desde"', async () => {
    const el = await render(() => of(routes));

    const cards = Array.from(el.querySelectorAll('li')).map((c) => c.textContent ?? '');
    expect(cards[0]).toMatch(/\$\s?2\.600/);
    expect(cards[0]).not.toContain('Desde');
    expect(cards[1]).toMatch(/Desde\s+\$\s?3\.000/);
  });

  it('sin rutas activas muestra el aviso, no una lista vacía', async () => {
    const el = await render(() => of([]));

    expect(el.textContent).toContain('no hay rutas activas');
  });

  it('si el backend falla muestra un error y NO rutas de respaldo inventadas', async () => {
    const el = await render(() => throwError(() => new Error('sin conexión')));

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar');
    expect(el.querySelectorAll('li')).toHaveLength(0);
  });

  // --- T15 (SCRUM-199): con internet lento el error no puede ser el final del camino ---

  it('el error trae un botón "Reintentar" que vuelve a pedir y muestra las rutas', async () => {
    let intento = 0;
    const pedir = vi.fn(() => {
      intento += 1;
      return intento === 1 ? throwError(() => new Error('se cayó la red')) : of(routes);
    });
    const fixture = await renderFixture(pedir);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')).not.toBeNull();

    const boton = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar'));
    expect(boton, 'el error debe ofrecer reintentar').toBeDefined();
    boton!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pedir).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('li')).toHaveLength(2);
  });

  it('sin red no dice "no se pudo": dice que está esperando, y vuelve a pedir solo cuando la red regresa', async () => {
    const vuelveLaRed = new Subject<void>();
    let intento = 0;
    const pedir = vi.fn(() => {
      intento += 1;
      return intento === 1 ? throwError(() => new Error('sin red')) : of(routes);
    });
    const fixture = await renderFixture(pedir, { online: false, vuelveLaRed });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Apenas vuelva, cargamos las rutas solos');
    expect(el.textContent).not.toContain('No se pudo cargar');
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.textContent).not.toContain('no hay rutas activas');

    vuelveLaRed.next();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pedir).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('li')).toHaveLength(2);
  });

  it('con red, el fallo del backend sí es un error, y no se queda esperando un evento que no llegará', async () => {
    const el = await render(() => throwError(() => new Error('500')), { online: true });

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar');
    expect(el.textContent).not.toContain('Apenas vuelva');
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Reintentar'))).toBe(true);
  });

  it('la tarjeta nunca muestra aviso de congestión: el listado no lo manda, y el aviso vive en el detalle', async () => {
    // GET /api/routes no devuelve `congestionSectors` (SCRUM-154): depende de la hora y
    // obligaría a no cachear el listado. Aunque un backend futuro lo mandara, la tarjeta
    // no lo pinta; el aviso exacto está en el detalle de la ruta.
    const conSectores: Route[] = [
      { ...routes[0], congestionSectors: [{ name: 'Centro - Carrera 1', startsAt: '17:00:00', endsAt: '19:00:00' }] },
      routes[1]
    ];
    const el = await render(() => of(conSectores));

    expect(el.textContent).not.toContain('Puede haber congestión');
    expect(el.querySelectorAll('li')).toHaveLength(2);
  });
});
