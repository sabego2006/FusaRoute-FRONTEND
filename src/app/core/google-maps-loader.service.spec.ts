import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { GoogleMapsLoaderService, MAPS_LOAD_BUDGET_MS } from './google-maps-loader.service';
import { environment } from '../../environments/environment';

const claveOriginal = environment.googleMapsApiKey;
const CALLBACK = '__fusarouteGoogleMapsReady';

function limpiarScripts() {
  document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((s) => s.remove());
}

/** Lo que hace Google cuando la API termina de instalarse: invocar el callback de la URL. */
function googleTerminaDeInstalarLaApi() {
  (window as unknown as Record<string, (() => void) | undefined>)[CALLBACK]?.();
}

describe('GoogleMapsLoaderService', () => {
  afterEach(() => {
    environment.googleMapsApiKey = claveOriginal;
    delete window.gm_authFailure;
    delete (window as unknown as Record<string, unknown>)[CALLBACK];
    limpiarScripts();
  });

  it('sin clave configurada, no inyecta el script y queda en "sin-clave"', async () => {
    environment.googleMapsApiKey = '';
    const service = new GoogleMapsLoaderService();

    await expect(service.load()).rejects.toThrow();

    expect(document.querySelector('script[src*="maps.googleapis.com"]')).toBeNull();
    expect(service.status()).toBe('sin-clave');
  });

  it('con clave, inyecta exactamente un script y queda en "listo" cuando Google llama al callback', async () => {
    environment.googleMapsApiKey = 'clave-de-prueba';
    const service = new GoogleMapsLoaderService();

    const promesa = service.load();
    const script = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]');
    expect(script).not.toBeNull();
    expect(script?.src).toContain('key=clave-de-prueba');

    googleTerminaDeInstalarLaApi();
    await promesa;

    expect(service.status()).toBe('listo');
  });

  it('la URL pide el callback, que es lo que exige loading=async', () => {
    environment.googleMapsApiKey = 'clave-de-prueba';
    const service = new GoogleMapsLoaderService();
    void service.load();

    const src = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]')?.src ?? '';

    expect(src).toContain('loading=async');
    expect(src).toContain(`callback=${CALLBACK}`);

    googleTerminaDeInstalarLaApi();
  });

  it('que el ARCHIVO termine de bajar no basta: sin callback no se declara "listo"', async () => {
    // SCRUM-184, el bug que esto evita: con loading=async, onload dispara cuando baja el
    // archivo, no cuando la API esta completa. Declarar 'listo' ahi hacia que <google-map>
    // reventara con "google.maps.importLibrary is not a function" y el mapa quedara en blanco,
    // sin mapa y sin aviso de error.
    environment.googleMapsApiKey = 'clave-de-prueba';
    const service = new GoogleMapsLoaderService();

    void service.load();
    document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]')?.onload?.(new Event('load'));

    expect(service.status()).toBe('cargando');

    googleTerminaDeInstalarLaApi();
    expect(service.status()).toBe('listo');
  });

  it('dos load() seguidos no inyectan un segundo script', async () => {
    environment.googleMapsApiKey = 'clave-de-prueba';
    const service = new GoogleMapsLoaderService();

    const primera = service.load();
    const segunda = service.load();
    googleTerminaDeInstalarLaApi();
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

  it('si Google rechaza la clave (gm_authFailure), queda en "error" aunque la API ya se haya instalado', async () => {
    environment.googleMapsApiKey = 'clave-restringida-a-otro-dominio';
    const service = new GoogleMapsLoaderService();

    const promesa = service.load();
    // Orden real observado: Google instala la API y rechaza la clave después.
    googleTerminaDeInstalarLaApi();
    await promesa;
    expect(service.status()).toBe('listo');

    window.gm_authFailure?.();

    expect(service.status()).toBe('error');
  });

  describe('presupuesto de tiempo (T15)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('si Google no contesta dentro del presupuesto, pasa a "error" y el componente muestra el aviso', () => {
      environment.googleMapsApiKey = 'clave-de-prueba';
      const service = new GoogleMapsLoaderService();
      void service.load();

      vi.advanceTimersByTime(MAPS_LOAD_BUDGET_MS - 1);
      expect(service.status()).toBe('cargando');

      vi.advanceTimersByTime(2);

      expect(service.status()).toBe('error');
    });

    it('si Google llega tarde, el mapa igual aparece: el estado vuelve a "listo"', () => {
      environment.googleMapsApiKey = 'clave-de-prueba';
      const service = new GoogleMapsLoaderService();
      void service.load();

      vi.advanceTimersByTime(MAPS_LOAD_BUDGET_MS + 1);
      expect(service.status()).toBe('error');

      googleTerminaDeInstalarLaApi();

      expect(service.status()).toBe('listo');
    });

    it('si Google contesta a tiempo, el presupuesto no vuelve a tocar el estado', () => {
      environment.googleMapsApiKey = 'clave-de-prueba';
      const service = new GoogleMapsLoaderService();
      void service.load();

      googleTerminaDeInstalarLaApi();
      vi.advanceTimersByTime(MAPS_LOAD_BUDGET_MS * 2);

      expect(service.status()).toBe('listo');
    });
  });
});
