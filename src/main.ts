import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadRuntimeConfig } from './app/core/runtime-config';

// La configuracion de ejecucion va antes del arranque: los servicios leen
// environment.apiUrl al construirse. Fuera de la imagen Docker no hace nada.
loadRuntimeConfig()
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
