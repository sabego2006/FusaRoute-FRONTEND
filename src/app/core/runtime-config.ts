import { environment } from '../../environments/environment';

/** Forma de /config.json, que Nginx arma con las variables de entorno del contenedor. */
interface RuntimeConfig {
  apiUrl?: unknown;
  googleMapsApiKey?: unknown;
}

/**
 * Configuracion de ejecucion (factor 3). Se llama en main.ts ANTES de arrancar
 * Angular: los servicios leen `environment.apiUrl` al construirse, asi que el
 * valor tiene que estar puesto antes de que exista el primero.
 *
 * Solo actua cuando el ambiente lo pide (`runtimeConfig`, hoy solo la imagen
 * Docker). En Vercel y en `ng serve` no hace ninguna peticion: la URL sigue
 * compilada y el primer pintado (RNF-01) no paga un viaje de red extra.
 *
 * Si /config.json falla o trae algo que no es texto, se conservan los valores
 * compilados: una configuracion rota no debe dejar la pantalla en blanco.
 */
export async function loadRuntimeConfig(fetchFn: typeof fetch = fetch): Promise<void> {
  if (!environment.runtimeConfig) {
    return;
  }
  try {
    const response = await fetchFn('config.json', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const config = (await response.json()) as RuntimeConfig;
    if (typeof config.apiUrl === 'string') {
      // Sin barra final: los servicios concatenan `${apiUrl}/api/...`.
      environment.apiUrl = config.apiUrl.replace(/\/+$/, '');
    }
    if (typeof config.googleMapsApiKey === 'string') {
      environment.googleMapsApiKey = config.googleMapsApiKey;
    }
  } catch {
    // Sin red o JSON invalido: quedan los valores compilados.
  }
}
