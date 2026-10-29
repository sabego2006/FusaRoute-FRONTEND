/**
 * Ambiente PROD — reemplaza a environment.ts en `ng build --configuration production`.
 *
 * apiUrl apunta al backend en Render (tier gratis: cold start de hasta ~60 s
 * tras inactividad).
 *
 * Regla de la seccion 12 de la guia de buenas practicas: NUNCA una clave
 * secreta en este archivo. Todo lo que llega al navegador es inspeccionable.
 * La clave de Google Maps que vive aqui es la del frontend, publica por
 * naturaleza, y va restringida por dominio en la consola de Google Cloud
 * (SCRUM-168).
 */
export const environment = {
  production: true,
  apiUrl: 'https://fusaroute-backend.onrender.com',
  googleMapsApiKey: 'AIzaSyB43vsKM3B9vlCyxkikPuMI3rl-3F-uMe8',
};