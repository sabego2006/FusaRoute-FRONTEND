import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import { defer, firstValueFrom, of, throwError } from 'rxjs';
import { isTransient, retryTransient } from './retry-transient';

const error = (status: number) => new HttpErrorResponse({ status });

describe('isTransient', () => {
  it('reintenta lo que se corta o lo que el servidor pide reintentar', () => {
    for (const status of [0, 408, 429, 500, 502, 503, 504]) {
      expect(isTransient(error(status)), `status ${status}`).toBe(true);
    }
  });

  it('no reintenta un error del cliente', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isTransient(error(status)), `status ${status}`).toBe(false);
    }
  });

  it('no reintenta algo que no es una respuesta HTTP', () => {
    expect(isTransient(new Error('cualquier cosa'))).toBe(false);
    expect(isTransient(null)).toBe(false);
  });
});

describe('retryTransient', () => {
  it('vuelve a pedir tras un corte de red y entrega el segundo intento', async () => {
    let intentos = 0;
    const fuente = defer(() => {
      intentos += 1;
      return intentos === 1 ? throwError(() => error(0)) : of('catálogo');
    });

    const valor = await firstValueFrom(fuente.pipe(retryTransient(2, 1)));

    expect(valor).toBe('catálogo');
    expect(intentos).toBe(2);
  });

  it('se rinde después de los intentos acordados y propaga el error', async () => {
    const pedir = vi.fn(() => throwError(() => error(0)));

    await expect(firstValueFrom(defer(pedir).pipe(retryTransient(2, 1)))).rejects.toMatchObject({ status: 0 });
    // El original más dos reintentos.
    expect(pedir).toHaveBeenCalledTimes(3);
  });

  it('un 404 no se reintenta ni una vez', async () => {
    const pedir = vi.fn(() => throwError(() => error(404)));

    await expect(firstValueFrom(defer(pedir).pipe(retryTransient(2, 1)))).rejects.toMatchObject({ status: 404 });
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('la espera crece entre intentos', async () => {
    const inicio = Date.now();
    let intentos = 0;
    const fuente = defer(() => {
      intentos += 1;
      return intentos < 3 ? throwError(() => error(0)) : of('ok');
    });

    await firstValueFrom(fuente.pipe(retryTransient(2, 30)));

    // 30 ms del primer reintento + 60 ms del segundo.
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(80);
  });
});
