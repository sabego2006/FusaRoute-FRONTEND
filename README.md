# FusaRoute Frontend

Interfaz web para el sistema de información de transporte público de Fusagasugá.
Proyecto Integrador de Ingeniería de Software I, Universidad de Cundinamarca.

## Stack

| | Versión |
|---|---|
| Angular | **21** |
| TypeScript | 5.9 |
| Node.js | 22 LTS |
| PWA | `@angular/service-worker` |

Se arranca en la versión vigente de cada herramienta, no en una anterior. Un salto de
versión mayor es una decisión propia, con su tarjeta; no se hace a mitad de sprint.

## Instalación y ejecución (ambiente DEV)

```bash
npm ci
cp .env.example .env      # y llenarlo
npm start                 # http://localhost:4200
```

`npm start` levanta el frontend contra el backend en `http://localhost:8080`, que es lo que
declara `src/environments/environment.ts`. El backend tiene que estar corriendo aparte.

## PWA

La aplicación es instalable desde el navegador («Añadir a pantalla de inicio»), sin pasar por
Play Store ni App Store. El service worker **está desactivado en `ng serve`** a propósito;
para probar la instalación hay que servir el build:

```bash
ng build
npx http-server -p 8081 -c-1 dist/fusaroute-frontend/browser
```

Solo funciona sobre HTTPS o sobre `localhost` — es una regla del navegador. Y ojo: el service
worker hace que **la app cargue** sin red; **no** es el modo offline del requisito, que es un
endpoint del backend que calcula la ruta por distancia sobre los GeoJSON.

## Seguridad

**Ninguna clave secreta va en este repositorio.** Todo lo que se compila en Angular viaja al
navegador y es inspeccionable; los secretos viven solo en el backend. `.env.example` está
versionado con los valores vacíos y es la lista de las variables que existen.
