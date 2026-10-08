/**
 * Ambiente PROD — reemplaza a environment.ts en `ng build --configuration production`.
 *
 * apiUrl apunta al backend en Render (tier gratis: cold start de hasta ~60 s
 * tras inactividad). googleMapsApiKey se llena cuando aterrice SCRUM-168
 * (spike de Google Maps); hasta entonces se deja vacío, no inventado.
 *
 * Regla de la seccion 12 de la guia de buenas practicas: NUNCA una clave
 * secreta en este archivo.dor es inspeccionable.
 * La clave de Google Maps que vivira aqui es la del frontend, publica por
 * naturaleza, y va restringida por dominio en la consola de Google Cloud.
 */
export const environment = {
  production: true,
  apiUrl: 'https://fusaroute-backend.onrender.com',
  googleMapsApiKey: '',
};