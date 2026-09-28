/**
 * Ambiente PROD — reemplaza a environment.ts en `ng build --configuration production`.
 *
 * Se llena en el Sprint 2, cuando exista el proyecto Supabase de PROD.
 * Declarado sin adornos: este semestre PROD no esta desplegado en ningun
 * servidor; el backend corre desde un portatil el dia de la demostracion, asi
 * que apiUrl apuntara a esa maquina.
 */
export const environment = {
  production: true,
  apiUrl: '',
  googleMapsApiKey: '',
};
