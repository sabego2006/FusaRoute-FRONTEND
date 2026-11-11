/**
 * Ambiente LHCI — el que usa el job `lighthouse` del CI (SCRUM-127/136).
 *
 * apiUrl vacío (mismo origen que `http-server`): Lighthouse corre contra el build
 * servido en localhost, sin el backend de Render detrás. Con environment.prod
 * apuntando al backend real, el LCP medido quedaba dominado por la latencia (o el
 * fallo) de esa llamada de red externa — no por el peso real de la pantalla — y el
 * mensaje de error de "/api/routes" pasaba a ser el elemento de LCP. El fixture
 * estático en `public/api/routes` responde esa llamada sin salir a internet.
 */
export const environment = {
  production: true,
  apiUrl: '',
  googleMapsApiKey: 'AIzaSyB43vsKM3B9vlCyxkikPuMI3rl-3F-uMe8',
  /** Datos simulados del contrato de lugares (solo la configuracion mock). */
  mockApi: false,
  /** Leer apiUrl y googleMapsApiKey de /config.json al arrancar (solo la imagen Docker). */
  runtimeConfig: false,
};
