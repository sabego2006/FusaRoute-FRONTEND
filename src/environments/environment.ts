/**
 * Ambiente DEV — el que se usa con `ng serve`.
 *
 * El codigo nunca cambia entre ambientes: en el build de produccion, Angular
 * reemplaza este archivo por environment.prod.ts (fileReplacements en
 * angular.json). Ningun servicio debe leer una URL que no venga de aqui.
 *
 * Regla de la seccion 12 de la guia de buenas practicas: NUNCA una clave
 * secreta en este archivo. Todo lo que llega al navegador es inspeccionable.
 * La clave de Google Maps que vive aqui es la del frontend, publica por
 * naturaleza, y va restringida por dominio en la consola de Google Cloud.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  googleMapsApiKey: '',
};
