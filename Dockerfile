# Imagen del frontend: Angular compilado y servido por Nginx.
# Dos etapas: Node compila el bundle y la imagen final solo lleva Nginx y los
# archivos estaticos. Ni Node, ni node_modules, ni el codigo fuente llegan a la
# imagen que se ejecuta.

# --- Etapa 1: compilar el bundle ---
# Node 22 es la version que fijan .nvmrc y "engines" del package.json: la misma
# del CI, para que la imagen no compile con un Node distinto al que se prueba.
FROM node:22-alpine AS build
WORKDIR /build

# Los manifiestos van solos primero para que `npm ci` quede en una capa
# cacheable: si solo cambia el codigo, Docker no vuelve a bajar las dependencias.
# .npmrc viaja con ellos porque trae legacy-peer-deps, sin el cual npm ci falla.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# "production,docker": el mismo build optimizado de produccion, pero con
# environment.docker.ts, que NO trae la URL del backend ni la clave de Maps
# compiladas: se leen de /config.json cuando el contenedor arranca (factor 3).
# Asi una sola imagen sirve para cualquier ambiente.
RUN npx ng build --configuration=production,docker

# --- Etapa 2: imagen de ejecucion ---
# nginx-unprivileged es la imagen oficial de Nginx Inc. que corre como el usuario
# nginx (uid 101) en vez de root, y por eso escucha en 8080 y no en 80: un
# proceso sin privilegios no puede abrir puertos por debajo de 1024.
FROM nginxinc/nginx-unprivileged:1.28-alpine

# Valores por defecto de la configuracion de ejecucion. Se pisan con `-e` o con
# `environment:` en docker-compose; ninguno es un secreto (todo lo que llega al
# navegador es inspeccionable).
ENV API_URL=http://localhost:8080 \
    GOOGLE_MAPS_API_KEY=""

# La imagen de Nginx pasa por envsubst todo lo que haya en /etc/nginx/templates
# al arrancar y deja el resultado en /etc/nginx/conf.d: ahi es donde API_URL y
# GOOGLE_MAPS_API_KEY entran a la respuesta de /config.json.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

COPY --from=build /build/dist/fusaroute-frontend/browser /usr/share/nginx/html

EXPOSE 8080

# 127.0.0.1 y no localhost: en Alpine localhost puede resolver a ::1 y Nginx
# aqui solo escucha en IPv4.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
