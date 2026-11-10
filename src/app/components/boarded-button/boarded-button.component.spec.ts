import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardedButtonComponent } from './boarded-button.component';
import { RideService } from '../../services/ride.service';
import { Ride, RideDraft } from '../../models/ride.model';

const DRAFT: RideDraft = {
  routeId: 14, routeName: 'R', signFile: null, destinationLabel: 'Terminal', destinationPlaceId: 31,
  destinationLat: 4.3, destinationLng: -74.3, originLabel: 'Indio',
};

describe('BoardedButtonComponent', () => {
  let pending: Subject<Ride>;
  const board = vi.fn();

  beforeEach(async () => {
    board.mockReset();
    board.mockImplementation(() => { pending = new Subject<Ride>(); return pending; });
    await TestBed.configureTestingModule({
      imports: [BoardedButtonComponent],
      providers: [{ provide: RideService, useValue: { board } }],
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(BoardedButtonComponent);
    fixture.componentRef.setInput('draft', DRAFT);
    fixture.detectChanges();
    const button = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, button };
  }

  it('pasa por guardando y termina en ✓ ¡Buen viaje!, sin poder repetirse', () => {
    const { fixture, button } = render();
    expect(button().textContent).toContain('¡Ya me subí!');

    button().click();
    fixture.detectChanges();
    expect(button().textContent).toContain('Guardando');
    expect(button().disabled).toBe(true);

    pending.next({ id: 1 } as Ride);
    pending.complete();
    fixture.detectChanges();
    expect(button().textContent).toContain('✓ ¡Buen viaje!');
    expect(button().disabled).toBe(true);

    button().click();
    expect(board).toHaveBeenCalledTimes(1);
  });

  it('si falla, lo dice y deja reintentar', () => {
    const { fixture, button } = render();
    button().click();
    pending.error(new Error('500'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(button().disabled).toBe(false);
    button().click();
    expect(board).toHaveBeenCalledTimes(2);
  });

  it('un resultado nuevo lo vuelve a habilitar', () => {
    const { fixture, button } = render();
    button().click();
    pending.next({ id: 1 } as Ride);
    fixture.detectChanges();

    fixture.componentRef.setInput('draft', { ...DRAFT, routeId: 15 });
    fixture.detectChanges();
    expect(button().textContent).toContain('¡Ya me subí!');
    expect(button().disabled).toBe(false);
  });

  it('mide al menos 44 px de alto (zona táctil)', () => {
    const { button } = render();
    expect(parseInt(getComputedStyle(button()).minHeight, 10)).toBeGreaterThanOrEqual(44);
  });
});
