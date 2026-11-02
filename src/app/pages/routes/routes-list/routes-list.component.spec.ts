import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError, of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { RoutesListComponent } from './routes-list.component';
import { RouteService } from '../../../services/route.service';
import { Route } from '../../../models/route.model';

async function render(getAllPublicRoutes: () => unknown) {
  await TestBed.configureTestingModule({
    imports: [RoutesListComponent],
    providers: [provideRouter([]), { provide: RouteService, useValue: { getAllPublicRoutes } }]
  }).compileComponents();

  const fixture = TestBed.createComponent(RoutesListComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
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

    expect(el.textContent).toContain('No se encontraron rutas activas');
  });

  it('si el backend falla muestra un error y NO rutas de respaldo inventadas', async () => {
    const el = await render(() => throwError(() => new Error('sin conexión')));

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar');
    expect(el.querySelectorAll('li')).toHaveLength(0);
  });

  it('con sectores en trancón, la tarjeta de esa ruta avisa posible congestión y la otra no', async () => {
    const conSectores: Route[] = [
      { ...routes[0], congestionSectors: [{ name: 'Centro - Carrera 1', startsAt: '17:00:00', endsAt: '19:00:00' }] },
      routes[1]
    ];
    const el = await render(() => of(conSectores));

    const cards = Array.from(el.querySelectorAll('li'));
    expect(cards[0].textContent).toContain('Puede haber congestión');
    expect(cards[1].textContent).not.toContain('Puede haber congestión');
  });

  it('si el backend no manda el campo (build viejo), la tarjeta no muestra aviso y no se rompe', async () => {
    // `routes` no trae `congestionSectors` en ninguna de las dos: es justo ese backend viejo.
    const el = await render(() => of(routes));

    expect(el.textContent).not.toContain('Puede haber congestión');
    expect(el.querySelectorAll('li')).toHaveLength(2);
  });
});
