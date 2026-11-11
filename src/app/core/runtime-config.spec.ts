import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../environments/environment';
import { loadRuntimeConfig } from './runtime-config';

describe('loadRuntimeConfig', () => {
  const original = { ...environment };

  const respondWith = (body: unknown, ok = true) =>
    vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }) as unknown as typeof fetch;

  beforeEach(() => {
    environment.runtimeConfig = true;
  });

  afterEach(() => {
    Object.assign(environment, original);
  });

  it('no pide nada cuando el ambiente no usa configuracion de ejecucion', async () => {
    environment.runtimeConfig = false;
    const fetchFn = respondWith({ apiUrl: 'http://otro' });

    await loadRuntimeConfig(fetchFn);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(environment.apiUrl).toBe(original.apiUrl);
  });

  it('aplica la URL del backend y la clave de Maps que entrega /config.json', async () => {
    const fetchFn = respondWith({ apiUrl: 'http://backend:9000', googleMapsApiKey: 'clave-publica' });

    await loadRuntimeConfig(fetchFn);

    expect(fetchFn).toHaveBeenCalledWith('config.json', { cache: 'no-store' });
    expect(environment.apiUrl).toBe('http://backend:9000');
    expect(environment.googleMapsApiKey).toBe('clave-publica');
  });

  it('quita la barra final de la URL para no duplicarla al concatenar', async () => {
    await loadRuntimeConfig(respondWith({ apiUrl: 'http://backend:9000/' }));

    expect(environment.apiUrl).toBe('http://backend:9000');
  });

  it('acepta la URL vacia: mismo origen que el frontend', async () => {
    await loadRuntimeConfig(respondWith({ apiUrl: '' }));

    expect(environment.apiUrl).toBe('');
  });

  it('conserva los valores compilados si la respuesta no es exitosa', async () => {
    await loadRuntimeConfig(respondWith({ apiUrl: 'http://otro' }, false));

    expect(environment.apiUrl).toBe(original.apiUrl);
  });

  it('ignora valores que no son texto', async () => {
    await loadRuntimeConfig(respondWith({ apiUrl: 42, googleMapsApiKey: null }));

    expect(environment.apiUrl).toBe(original.apiUrl);
    expect(environment.googleMapsApiKey).toBe(original.googleMapsApiKey);
  });

  it('conserva los valores compilados si la peticion falla', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('sin red')) as unknown as typeof fetch;

    await expect(loadRuntimeConfig(fetchFn)).resolves.toBeUndefined();
    expect(environment.apiUrl).toBe(original.apiUrl);
  });
});
