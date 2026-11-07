import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HistoryComponent } from './history.component';
import { SearchHistoryEntry } from '../../models/history.model';
import { environment } from '../../../environments/environment';

describe('HistoryComponent', () => {
  let http: HttpTestingController;

  const historyUrl = `${environment.apiUrl}/api/users/me/history`;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function entry(over: Partial<SearchHistoryEntry> = {}): SearchHistoryEntry {
    return {
      id: 1,
      origin: 'Siboney',
      destination: 'Centro',
      searchedAt: '2026-10-29T19:00:00Z',
      routeAvailable: true,
      ...over,
    };
  }

  /** Monta la pantalla y responde el GET del historial con `entries`. */
  function mount(entries: SearchHistoryEntry[]) {
    const fixture = TestBed.createComponent(HistoryComponent);
    fixture.detectChanges();
    http.expectOne(historyUrl).flush(entries);
    fixture.detectChanges();
    return fixture;
  }

  function textOf(fixture: { nativeElement: unknown }): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function buttonsOf(fixture: { nativeElement: unknown }): HTMLButtonElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('li button'),
    );
  }

  it('pide el historial al abrir la pantalla', () => {
    const fixture = TestBed.createComponent(HistoryComponent);
    fixture.detectChanges();

    const req = http.expectOne(historyUrl);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('muestra las entradas en el orden que llegan del backend, sin reordenarlas', () => {
    // El backend ya manda de la más reciente a la más antigua (RF-07): la pantalla no
    // vuelve a ordenar, porque entonces habría dos reglas de orden que mantener.
    const fixture = mount([
      entry({ id: 3, origin: 'Siboney', destination: 'Centro' }),
      entry({ id: 2, origin: 'Gaitán', destination: 'Terminal de Transporte' }),
      entry({ id: 1, origin: 'Maíz Amarillo', destination: 'Galería' }),
    ]);

    const trayectos = buttonsOf(fixture).map((b) => b.textContent ?? '');
    expect(trayectos).toHaveLength(3);
    expect(trayectos[0]).toContain('Siboney');
    expect(trayectos[1]).toContain('Gaitán');
    expect(trayectos[2]).toContain('Maíz Amarillo');
  });

  it('muestra las seis entradas cuando el backend manda el tope completo', () => {
    const seis = Array.from({ length: 6 }, (_, i) =>
      entry({ id: i + 1, origin: `Barrio ${i + 1}`, destination: 'Centro' }),
    );

    expect(buttonsOf(mount(seis))).toHaveLength(6);
  });

  it('al pulsar una entrada navega al buscador con ese origen y ese destino', () => {
    const fixture = mount([entry({ origin: 'Siboney', destination: 'Centro' })]);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    buttonsOf(fixture)[0].click();

    expect(navigate).toHaveBeenCalledWith(['/rutas/buscar'], {
      queryParams: { origen: 'Siboney', destino: 'Centro' },
    });
  });

  it('la entrada sobre una ruta no disponible se ve, dice por qué y no se puede repetir', () => {
    const fixture = mount([entry({ routeAvailable: false })]);

    // Se sigue viendo: el criterio de RF-11 pide que el historial quede intacto.
    expect(textOf(fixture)).toContain('Siboney');
    expect(textOf(fixture)).toContain('Ruta ya no disponible');
    expect(buttonsOf(fixture)[0].disabled).toBe(true);
  });

  it('repetir una entrada no disponible no navega, aunque se invoque directo', () => {
    const fixture = mount([entry({ routeAvailable: false })]);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.repeat(entry({ routeAvailable: false }));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('una entrada sin la clave routeAvailable se trata como disponible', () => {
    // Pasa mientras el backend desplegado sea anterior a ese campo: la ausencia del
    // dato no puede significar "trayecto perdido".
    const sinClave: SearchHistoryEntry = {
      id: 1, origin: 'Siboney', destination: 'Centro', searchedAt: '2026-10-29T19:00:00Z',
    };
    const fixture = mount([sinClave]);

    expect(buttonsOf(fixture)[0].disabled).toBe(false);
    expect(textOf(fixture)).not.toContain('Ruta ya no disponible');
  });

  it('un historial vacío invita a buscar en vez de mostrar una lista vacía', () => {
    const fixture = mount([]);

    expect(textOf(fixture)).toContain('Todavía no has buscado');
    expect(buttonsOf(fixture)).toHaveLength(0);
  });

  it('el botón del historial vacío lleva al buscador', () => {
    const fixture = mount([]);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.fr-btn')!.click();

    expect(navigate).toHaveBeenCalledWith(['/rutas/buscar'], undefined);
  });

  it('si el historial falla lo dice y no deja la pantalla cargando', () => {
    const fixture = TestBed.createComponent(HistoryComponent);
    fixture.detectChanges();
    http.expectOne(historyUrl).flush(
      { type: 'about:blank', title: 'Server Error', status: 500, detail: null },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(false);
    expect(textOf(fixture)).toContain('No pudimos cargar tu historial');
  });

  it('cada entrada anuncia al lector de pantalla si se puede repetir o no', () => {
    const fixture = mount([
      entry({ id: 2, routeAvailable: true }),
      entry({ id: 1, origin: 'Gaitán', destination: 'Terminal', routeAvailable: false }),
    ]);

    const labels = buttonsOf(fixture).map((b) => b.getAttribute('aria-label'));
    expect(labels[0]).toBe('Repetir la búsqueda de Siboney a Centro');
    expect(labels[1]).toBe('Gaitán a Terminal: ruta ya no disponible');
  });

  it('una fecha ilegible no rompe la pantalla', () => {
    const fixture = mount([entry({ searchedAt: 'no-es-una-fecha' })]);

    expect(textOf(fixture)).toContain('Siboney');
    expect(fixture.componentInstance.formatDate('no-es-una-fecha')).toBe('');
  });
});
