import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectivityService } from './connectivity.service';

function simularNavegador(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

describe('ConnectivityService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));
  afterEach(() => vi.restoreAllMocks());

  it('arranca con el estado que reporta el navegador', () => {
    simularNavegador(false);

    expect(TestBed.inject(ConnectivityService).isOnline()).toBe(false);
  });

  it('pasa a sin conexión cuando el navegador avisa que se cayó la red', () => {
    simularNavegador(true);
    const service = TestBed.inject(ConnectivityService);

    window.dispatchEvent(new Event('offline'));

    expect(service.isOnline()).toBe(false);
  });

  it('vuelve a con conexión cuando la red regresa', () => {
    simularNavegador(false);
    const service = TestBed.inject(ConnectivityService);

    window.dispatchEvent(new Event('online'));

    expect(service.isOnline()).toBe(true);
  });
});
