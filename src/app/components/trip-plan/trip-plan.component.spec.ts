import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { TripPlanComponent } from './trip-plan.component';
import { RouteSearchResult, TripSegment } from '../../models/route.model';

/** La ruta del caso que da nombre a la historia: pasa por A, B, C, D y E. */
function result(over: Partial<RouteSearchResult> = {}): RouteSearchResult {
  return {
    route: { id: 1, name: 'Centro - Galería - Terminal', type: 'URBANA', neighborhoods: ['A', 'B', 'C', 'D', 'E'], fares: [] },
    estimatedMinutes: 19,
    travelDistanceInMeters: 4614,
    boarding: { latitude: 4.33, longitude: -74.37, distanceInMeters: 293, walkingMinutes: 4 },
    dropOff: { latitude: 4.345, longitude: -74.377, distanceInMeters: 423, walkingMinutes: 6 },
    lastUpdatedAt: null,
    origin: { lat: 4.3316, lng: -74.3775, label: 'Monumento El Indio' },
    destination: { lat: 4.3458, lng: -74.3778, label: 'Terminal de Transporte' },
    ...over,
  };
}

function segment(over: Partial<TripSegment> = {}): TripSegment {
  return {
    ridePath: { type: 'LineString', coordinates: [[-74.37, 4.33], [-74.377, 4.345]] },
    neighborhoods: ['C', 'D', 'E'],
    boardingWalk: { bearingDegrees: 45, reference: 'Puente Águila' },
    dropOffWalk: { bearingDegrees: 180, reference: 'Plaza de Mercado' },
    ...over,
  };
}

/** Pinta el módulo y devuelve su elemento raíz. */
async function render(r: RouteSearchResult): Promise<HTMLElement> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({ imports: [TripPlanComponent] }).compileComponents();
  const fixture = TestBed.createComponent(TripPlanComponent);
  fixture.componentRef.setInput('result', r);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/** Todo el texto visible del módulo, con los espacios colapsados. */
const texto = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('TripPlanComponent', () => {
  it('ruta A-B-C-D-E con subida en C y bajada en E: muestra C, D y E, nunca A ni B', async () => {
    // Nombres de barrio reales, para que la comprobación no dependa de letras sueltas que
    // también aparecen dentro de otras palabras del módulo.
    const ruta = ['Mirazul', 'San Francisco', 'Indio', 'Cra 7', 'Terminal'];
    const tramo = ['Indio', 'Cra 7', 'Terminal'];
    const el = await render(result({
      route: { id: 1, name: 'Centro - Galería - Terminal', type: 'URBANA', neighborhoods: ruta, fares: [] },
      tripSegment: segment({ neighborhoods: tramo }),
    }));
    const barrios = el.querySelector('[data-testid="barrios-del-tramo"]')?.textContent?.replace(/\s+/g, ' ') ?? '';

    expect(barrios).toContain('Pasará por: Indio, Cra 7, Terminal.');
    // Los dos barrios por los que la buseta ya pasó no están en NINGUNA parte del módulo.
    expect(texto(el)).not.toContain('Mirazul');
    expect(texto(el)).not.toContain('San Francisco');
  });

  it('explica la caminata con minutos, metros, rumbo y lugar de referencia', async () => {
    const el = await render(result({ tripSegment: segment() }));

    expect(texto(el)).toContain('Camine 4 min (aprox. 293 m) hacia el nororiente hasta Puente Águila.');
    expect(texto(el)).toContain('Camine 6 min (aprox. 423 m) hacia el sur hasta Terminal de Transporte.');
  });

  it('dice dónde subir, dónde bajar y cuánto va en bus', async () => {
    const el = await render(result({ tripSegment: segment() }));

    expect(texto(el)).toContain('Suba a la buseta Centro - Galería - Terminal en Puente Águila.');
    expect(texto(el)).toContain('Bájese en Plaza de Mercado.');
    expect(texto(el)).toContain('4614 m en bus, unos 19 min.');
  });

  it('numera los momentos y los renumera cuando no hay caminata de entrada', async () => {
    const conCaminata = await render(result({ tripSegment: segment() }));
    expect(Array.from(conCaminata.querySelectorAll('.momento__marca')).map((n) => n.textContent?.trim()))
      .toEqual(['1', '2', '3']);

    // Sin caminata para subir, el bus pasa a ser el momento 1.
    const sinCaminataInicial = await render(result({
      boarding: { latitude: 4.33, longitude: -74.37, distanceInMeters: 0, walkingMinutes: 0 },
      tripSegment: segment(),
    }));
    expect(Array.from(sinCaminataInicial.querySelectorAll('.momento__marca')).map((n) => n.textContent?.trim()))
      .toEqual(['1', '2']);
  });

  it('con más de 5 barrios dice cuántos son y muestra 5 repartidos', async () => {
    const barrios = Array.from({ length: 8 }, (_, i) => `Barrio ${i + 1}`);
    const el = await render(result({ tripSegment: segment({ neighborhoods: barrios }) }));
    const linea = el.querySelector('[data-testid="barrios-del-tramo"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    expect(linea).toContain('Pasará por 8 barrios:');
    expect(linea).toContain('Barrio 1');
    expect(linea).toContain('Barrio 8');
  });

  it('sin barrios intermedios no pinta el rótulo "Pasará por"', async () => {
    const el = await render(result({ tripSegment: segment({ neighborhoods: [] }) }));

    expect(el.querySelector('[data-testid="barrios-del-tramo"]')).toBeNull();
    expect(texto(el)).not.toContain('Pasará por');
    // Pero el tramo en bus sí se dice.
    expect(el.querySelector('[data-testid="tramo-en-bus"]')).not.toBeNull();
  });

  it('subida igual a bajada: el tramo no tiene barrios y el módulo no inventa ninguno', async () => {
    const el = await render(result({
      travelDistanceInMeters: 0,
      tripSegment: segment({ ridePath: null, neighborhoods: [] }),
    }));

    expect(el.querySelector('[data-testid="barrios-del-tramo"]')).toBeNull();
    expect(texto(el)).toContain('0 m en bus');
  });

  it('un backend sin tripSegment lo dice en vez de volver a la ruta completa', async () => {
    const el = await render(result({ tripSegment: undefined }));

    expect(el.querySelector('[data-testid="sin-detalle-tramo"]')).not.toBeNull();
    expect(texto(el)).toContain('No tenemos el detalle del tramo de esta ruta');
    expect(el.querySelector('[data-testid="barrios-del-tramo"]')).toBeNull();
    // Y lo que sí se sabe sigue ahí: cuánto caminar y hasta dónde va.
    expect(texto(el)).toContain('Camine 4 min (aprox. 293 m).');
  });

  it('ruta sin trazado: lo dice con honestidad y no muestra pasos', async () => {
    const el = await render(result({ boarding: null, dropOff: null, tripSegment: undefined }));

    expect(el.querySelector('[data-testid="su-viaje"]')).toBeNull();
    expect(el.querySelector('[data-testid="sin-trazado"]')).not.toBeNull();
    expect(texto(el)).toContain('todavía no tiene su recorrido cargado');
  });

  it('sin rumbo no escribe "hacia el" vacío', async () => {
    const el = await render(result({
      tripSegment: segment({ boardingWalk: { bearingDegrees: null, reference: 'Puente Águila' } }),
    }));

    expect(texto(el)).toContain('Camine 4 min (aprox. 293 m) hasta Puente Águila.');
    expect(texto(el)).not.toContain('hacia el .');
  });
});
