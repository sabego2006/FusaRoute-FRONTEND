/**
 * Ambiente DOCKER — el de la imagen con Nginx (`ng build --configuration=production,docker`).
 *
 * A diferencia de environment.prod.ts, aqui NO se compila la URL del backend ni
 * la clave de Google Maps: `runtimeConfig: true` hace que main.ts pida
 * /config.json antes de arrancar Angular, y Nginx arma esa respuesta con las
 * variables de entorno del contenedor (API_URL, GOOGLE_MAPS_API_KEY). Una sola
 * imagen sirve para cualquier ambiente: es el factor 3 (configuracion) de los
 * 12 factores, que el build de Vercel no cumple.
 *
 * Los valores de abajo son solo el respaldo si /config.json no responde.
 */
export const environment = {
  production: true,
  apiUrl: 'http://localhost:8080',
  googleMapsApiKey: '',
  /** Datos simulados del contrato de lugares (solo la configuracion mock). */
  mockApi: false,
  /** Leer apiUrl y googleMapsApiKey de /config.json al arrancar. */
  runtimeConfig: true,
};
