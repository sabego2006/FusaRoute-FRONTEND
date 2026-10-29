import { describe, it, expect, afterEach } from 'vitest';
import { GoogleMapsLoaderService } from './google-maps-loader.service';
import { environment } from '../../environments/environment';

const claveOriginal = environment.googleMapsApiKey;

function limpiarScripts() {
  document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((s) => s.remove());
}

describe('GoogleMapsLoaderService', () => {
  afterEach(() => {
    environment.googleMapsApiKey = claveOriginal;
    delete window.gm_authFailure;
    limpiarScripts();
  });

  it('sin clave configurada, no inyecta el script y queda en "sin-clave"', async () => {
    environment.googleMapsApiKey = '';
    const service = new GoogleMapsLoaderService();

    await expect(service.load()).rejects.toThrow();

    expect(document.querySelector('script[src*="maps.googleapis.com"]')).toBeNull();
    expect(service.status()).toBe('sin-clave');
  });

  it('con clave, inyecta exactamente un script y queda en "listo" cuando carga', async () => {
    environment.googleMapsApiKey = 'clave-de-prueba';
    const service = new GoogleMapsLoaderService();

    const promesa = service.load();
    const script = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]');
    expect(script).not.toBeNull();
    expect(script?.src).toContain('key=clave-de-prueba');

    script?.onload?.(new Event('load'));
    await promesa;

    expect(service.status()).toBe('listo');
  });

  it('dos load() seguidos no inyectan un segundo script', async () => {
    environment.googleMapsApiKey = 'clave-de-prueba';
    const service = new GoogleMapsLoaderService();

    const primera = service.load();
    const segunda = service.load();
    document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]')?.onload?.(new Event('load'));
    await Promise.all([primera, segunda]);

    expect(document.querySelectorAll('script[src*="maps.googleapis.com"]')).toHaveLength(1);
  });

  it('si el script falla al cargar (onerror), queda en "error"', async () => {
    environment.googleMapsApiKey = 'clave-de-prueba';
    const service = new GoogleMapsLoaderService();

    const promesa = service.load();
    document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]')?.onerror?.(new Event('error'));

    await expect(promesa).rejects.toThrow();
    expect(service.status()).toBe('error');
  });

  it('si Google rechaza la clave (gm_authFailure), queda en "error" aunque el script sí haya cargado', async () => {
    environment.googleMapsApiKey = 'clave-restringida-a-otro-dominio';
    const service = new GoogleMapsLoaderService();

    const promesa = service.load();
    const script = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]');
    // Orden real observado: el script dispara onload, y gm_authFailure llega después.
    script?.onload?.(new Event('load'));
    await promesa;
    expect(service.status()).toBe('listo');

    window.gm_authFailure?.();

    expect(service.status()).toBe('error');
  });
});
