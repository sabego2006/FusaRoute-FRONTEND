import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RideHistoryComponent } from './ride-history.component';
import { LastDestinationChipComponent } from '../last-destination-chip/last-destination-chip.component';
import { Ride } from '../../models/ride.model';

function ride(id: number, signFile: string | null = 'CENTRO_GALERIA_TERMINAL'): Ride {
  return { id, routeId: 14, routeName: 'Centro - Terminal', signFile, destinationLabel: `Destino ${id}`,
    destinationPlaceId: id, destinationLat: 4.3, destinationLng: -74.3, originLabel: 'Indio',
    boardedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() };
}

describe('RideHistoryComponent', () => {
  it('plegado por defecto, con letrero, destino y fecha relativa; tocar emite el viaje', async () => {
    await TestBed.configureTestingModule({ imports: [RideHistoryComponent] }).compileComponents();
    const fixture = TestBed.createComponent(RideHistoryComponent);
    fixture.componentRef.setInput('rides', [ride(2), ride(1, null)]);
    let chosen: Ride | undefined;
    fixture.componentInstance.choose.subscribe((r) => (chosen = r));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect((el.querySelector('details') as HTMLDetailsElement).open).toBe(false);
    expect(el.querySelector('summary')?.textContent).toContain('Tus últimos viajes (2)');
    expect(el.querySelectorAll('li')).toHaveLength(2);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('letreros/CENTRO_GALERIA_TERMINAL.svg');
    expect(el.textContent).toContain('hace 2 días');

    (el.querySelectorAll('li button')[1] as HTMLButtonElement).click();
    expect(chosen?.id).toBe(1);
  });

  it('sin viajes no pinta nada', async () => {
    await TestBed.configureTestingModule({ imports: [RideHistoryComponent] }).compileComponents();
    const fixture = TestBed.createComponent(RideHistoryComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('details')).toBeNull();
  });
});

describe('LastDestinationChipComponent', () => {
  it('muestra "Volver a: <destino>" y emite el viaje al tocarlo', async () => {
    await TestBed.configureTestingModule({ imports: [LastDestinationChipComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LastDestinationChipComponent);
    fixture.componentRef.setInput('ride', ride(3));
    let chosen: Ride | undefined;
    fixture.componentInstance.choose.subscribe((r) => (chosen = r));
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    expect(button.textContent).toContain('Volver a: Destino 3');
    button.click();
    expect(chosen?.id).toBe(3);
  });

  it('sin último viaje no pinta nada', async () => {
    await TestBed.configureTestingModule({ imports: [LastDestinationChipComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LastDestinationChipComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
