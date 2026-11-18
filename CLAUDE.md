# FusaRoute — Frontend

Interfaz web del sistema de información de transporte público de Fusagasugá. Proyecto Integrador de Ingeniería de Software I, Universidad de Cundinamarca (docente: Ing. Luiferney Ortiz Parra).

**Recursos externos:** la carpeta del curso en OneDrive (`C:/Users/Santiago/OneDrive - UNIVERSIDAD DE CUNDINAMARCA/Universidad/5 SEMESTRE/INGENIERIA SOFTWARE I`) contiene la Actividad 3 v3 y el material de clase. Las 15 historias de usuario aprobadas (RF-01 a RF-15, con criterios de aceptación) están en `docs/backlog/historias-rf01-rf15.md` de esa misma carpeta, y los RNF en `docs/backlog/requisitos-no-funcionales.md` — es la fuente de las reglas de negocio de este archivo.

**Jira:** proyecto `SCRUM` en `fusaroute.atlassian.net`. 5 épicas (`SCRUM-7`..`SCRUM-11`), 15 historias (`SCRUM-12`..`SCRUM-26` + `SCRUM-153`, la parte de última milla/offline separada de HU_MF02_001), 7 RNF como Task (`SCRUM-127`..`SCRUM-133`). **Sprint Planning cerrado el 2026-09-17**: 9 sprints semanales, cada issue con Sprint + Story Points + responsable asignado, cada Subtask con descripción y responsable. El Sprint 1 (15→21 sep) cerró con velocidad 0; el Sprint 2 (22→28 sep) es el del comité del 28-sep: registro, login y catálogo público, más el perfil (`SCRUM-14`), que se adelantó al Sprint 2 y está en rama sin mergear. **Estado al 2026-11-07 (verificado en Jira):** el tablero no rotó los sprints al ritmo del calendario. El único sprint activo es «SCRUM Sprint 3» (fechas rancias del 5–6 oct) y Sprint 4 y 5 figuran como `future`, aunque el trabajo real va varios sprints por delante de esas etiquetas. Verificar siempre el sprint en Jira, nunca por fecha calculada a mano. Ver `docs/guia-jira-fusaroute.md` en la carpeta del curso para las convenciones completas del tablero.

El contexto completo del curso, el alcance del proyecto y las métricas de calidad comprometidas están en el `CLAUDE.md` de la carpeta madre de la asignatura.

**Equipo:** Santiago Bermúdez · Angélica Aranguren. Ambos trabajan todo el stack por exigencia del docente. Es la primera vez del equipo con Angular, así que las convenciones de este archivo se explican, no solo se enuncian.

**Despliegue (desde SCRUM-172, Sprint 3):** frontend en Vercel, `https://fusaroute.vercel.app` (build de `main`); backend en Render, `https://fusaroute-backend.onrender.com` (tier gratis, cold start hasta ~60 s). `environment.prod.ts` compila la URL del backend dentro del bundle — no hay variables de entorno que configurar en Vercel. `CORS_ALLOWED_ORIGINS` en Render debe incluir el dominio de Vercel vigente.

## Stack

- Angular 21 + **TypeScript** 5.9, con Angular CLI
- Angular Router para navegación
- Google Maps JavaScript API para visualizar rutas y paradas
- **Vitest** 4 como test runner (el que trae Angular 21 con `ng test`); no se usa Karma ni Jasmine

## Responsabilidad del frontend

El frontend **presenta y captura**, no decide. Concretamente:

- Interacción con el usuario y formularios (login, registro, búsqueda de ruta, caja de comentarios). **El usuario nunca escribe coordenadas** (SCRUM-130): origen y destino se indican de tres maneras, siempre a la vista en la pantalla de búsqueda (T16, SCRUM-195): escribir el lugar y elegirlo de la lista de lugares canónicos, "Usar mi ubicación" (solo el origen, por GPS del navegador) o "Señalar en el mapa" (un toque; queda como una ficha "Punto en el mapa", nunca como coordenadas). Un lugar o un punto de cada lado basta para buscar. Las coordenadas del GPS o del mapa las manda el frontend como lat/lng; las del lugar las deriva el backend por su id. Un campo de latitud o longitud en un formulario de usuario es un error de diseño, no una solución temporal.
- Visualización de rutas: trazado en el mapa (sin paradas formales — en Fusagasugá se para la buseta con la mano), barrios por los que pasa como **secuencia de pasos** (máximo 7: todos si son ≤7, o 7 distribuidos uniformemente incluyendo siempre primero y último si son más), costo del pasaje (precio único si es urbana; tabla de precios por punto de referencia de bajada, ordenada de menor a mayor, si es intermunicipal), y aviso de congestión presentado siempre como posibilidad ("puede haber congestión"), nunca como afirmación.
- Consumo de la API REST del backend.
- Detección de conectividad para usar el endpoint **online** (simulación en Google Maps) o el **offline** (cálculo por distancia sobre GeoJSON, sin tiempo estimado).
- Caja de comentarios: 10–100 caracteres, sin URLs; confirmación de envío como toast transitorio ("mensaje enviado") que desaparece solo, sin botón. Editar/borrar el propio comentario solo mientras esté pendiente de respuesta.
- Historial: últimas 6 búsquedas del usuario, iguales en cualquier dispositivo donde inicie sesión (vienen de la cuenta, no de almacenamiento local).

**Toda la lógica de negocio vive en el backend.** La simulación de cada ruta en Google Maps, la comparación de tiempos, el aviso de trancón, el cálculo offline por distancia y las validaciones de permisos se resuelven allá. Aquí no se replica ninguna de esas reglas: si hace falta una decisión de negocio, se pide un endpoint, no se calcula en el cliente. Validar en el formulario está bien para dar buena experiencia, pero **nunca sustituye** la validación del backend.

## Estructura de carpetas

```
src/app/
├── pages/         una carpeta por pantalla (Login, RouteSearch, RouteDetail, Profile, AdminRoutes...)
├── components/    piezas reutilizables (RouteCard, MapView, TrafficBadge, FareLabel...)
├── services/      clientes HTTP hacia el backend — el único lugar que hace peticiones
├── models/        interfaces TypeScript del dominio (Route, Stop, User, Feedback...)
├── core/          guards, interceptors y servicios singleton (auth, conectividad)
└── lib/           utilidades sin estado (formateo de moneda COP, de horas)
```

**Regla:** ningún componente hace `HttpClient` directamente. Toda llamada HTTP pasa por `services/`. Así, si cambia la URL base, el manejo del token o el endpoint online/offline, se toca un solo lugar — es la mitad frontend del atributo de mantenibilidad que evalúa el docente.

## TypeScript

Los tipos de `models/` **espejan el dominio del backend**. Cuando cambia un modelo allá, se actualiza aquí en el mismo sprint; un tipo desactualizado es peor que no tenerlo.

- Sin `any`. Si el tipo es desconocido, `unknown` y se estrecha con una comprobación.
- Las respuestas de la API se tipan explícitamente, no se infieren de un `HttpClient` suelto.
- `interface` para la forma de los datos, `type` para uniones (`type UserRole = 'USER' | 'ADMIN'`).

## Autenticación

El backend emite un JWT (Spring Security) con validez de **una semana** — al expirar, el frontend redirige al login (RNF-04: el login se pide como máximo 1 vez por semana). El frontend guarda el token, lo adjunta en el header `Authorization` de cada petición y redirige al login cuando recibe `401`. En login, hasta 4 intentos fallidos muestran "credenciales incorrectas"; al quinto, el backend bloquea temporalmente y el frontend muestra ese aviso específico, distinto del genérico. Recuperación de contraseña fuera de alcance este semestre.

**Segundo factor TOTP y dispositivo de confianza (SCRUM-196).** El login exige además un código TOTP (obligatorio para toda cuenta). Una cuenta **USER** no vuelve a verlo pedido durante 15 días **en el mismo dispositivo**, tras un código correcto; una cuenta **ADMIN** lo pide **siempre**. `AuthService` guarda el "dispositivo de confianza" que entrega el backend (`trustToken`, en `localStorage` junto al JWT de acceso — no una cookie, por el origen distinto Vercel/Render) y lo reenvía en cada login; `logout()` no lo borra. El backend decide por rol, nunca el cliente: el frontend solo guarda y reenvía el token, sin lógica propia.

**No se usa Supabase Auth.** El frontend nunca habla con Supabase: su única fuente de datos es la API del backend. Si aparece una dependencia de `@supabase/*` en este repo, es un error de arquitectura.

**Ocultar un botón de administrador no es seguridad**, es cortesía visual. El permiso real lo verifica el backend siempre.

## Google Maps

- La API key del frontend es **distinta** de la del backend y va **restringida por dominio** en la consola de Google Cloud. Es pública por naturaleza al viajar en el navegador; la restricción es lo que la protege.
- Se configura por variable de entorno (`NG_API_KEY` o equivalente según el sistema de environments de Angular). `.env` en `.gitignore`, `.env.example` versionado con la clave vacía.
- Maps se usa para **mostrar** rutas y paradas y para el mapa base. Adicionalmente, la **simulación de cada ruta para la búsqueda** se hace del lado del backend contra la Directions API de Google Maps; el frontend solo consume el endpoint ya resuelto y pinta la polilínea resultante. Las rutas de busetas siguen siendo dato propio: el backend envía a Maps la secuencia de paradas por ruta, no le pide a Maps que "invente" trayectos.

## Calidad medible (ISO/IEC 25010)

*Nota: Estas métricas deben verificarse contra la Actividad 3 v3.*

| Atributo | Métrica | Cómo se verifica |
|---|---|---|
| Usabilidad | flujo principal (buscar ruta) en máximo **4 acciones** sin contar login, con tasa de éxito ≥ 80 % al primer intento | recorrido manual del flujo (verificado, ver `docs/comite-3/evidencias/verificacion-rnf-04-usabilidad.md` en la carpeta del curso) + prueba con ≥ 5 usuarios externos al equipo (instrumento listo, pendiente de ejecución) |
| Rendimiento | LCP < 2.5 s en Lighthouse mobile Slow 4G sobre `/rutas/buscar` (pantalla de resultado de búsqueda) | Lighthouse CI en cada Pull Request (`npm run lighthouse`, job `lighthouse` en `ci.yml`), umbral versionado en `budgets.json` (SCRUM-127/SCRUM-136) |
| Mantenibilidad | 0 llamadas HTTP fuera de `services/`; sin `any` | revisión en PR |
| Accesibilidad | HTML semántico, formularios con `<label>`, navegable por teclado | revisión en PR |

Pensado para móvil: la mayoría de usuarios consultará la ruta desde el celular en la calle. Diseño responsive desde el inicio, no adaptado al final.

## Identidad visual (v2, aprobada por Santiago el 17–18 de noviembre de 2026)

Neobrutalismo de Fusagasugá con actitud de **sticker pegado**: irreverente, exagerado y colombiano, pero legible y rápido. Es inspiración de actitud (stickers, textos torcidos, colores chillones, cultura pop), no un clon de ninguna marca. La fuente única está en la carpeta de la sustentación (`sustentacion/diseno-v2/`: `ESTANDAR-VISUAL.md` la regla, `DECISIONES.md` lo aprobado con las palabras de Santiago, `PLAN-IMPLEMENTACION.md` el paso a paso por fases F1–F4, `ASSETS.md` los recursos y su licencia). **No se implementa nada de v2 sin el visto bueno escrito de Angélica.** Esta sección resume lo que hay que respetar al tocar la interfaz:

- **Se conserva** de T05: isotipo y wordmark, Suta (solo en estados vacío, error, éxito y sin conexión; nunca encima del buscador inicial), greca escalonada, letreros de buseta SVG y la paleta por municipio `--muni-*`.
- **Tipografías: 2 familias, 47,5 KB.** Bowlby One (OFL) para titulares, CTA, cintas, sellos y bocadillos; Plus Jakarta Sans para texto. Space Grotesk sale. Bowlby One se declara con `font-weight: 400 900` (un solo peso; sin negrita falsa). Texto en Bowlby sobre un fondo que da menos de 7:1 va a 24 px o más. Una tercera familia está prohibida.
- **Tokens nuevos:** `--rosa #FF5FAE`, `--sobre-rosa #0A0A0C`, `--crema #FFF6D6`, `--rojo-sello #A50F26`, `--lima-punto #C6EC7C`. Los valores ya están ajustados para 7:1 (`color-contrast-enhanced` en 0).
- **Botón primario** = sticker rosa torcido (−2,5°, sombra dura de 7 px, se hunde al presionar). En el buscador el CTA es el **sello** dentro del boleto. **Titular de cartel:** dos líneas desalineadas, las últimas dos palabras en caja amarilla.
- **Stickers:** personajes con foto real, fondo quitado y benday (Indio Sutagao, Lucho Herrera, La Pola, Gabo, Bolívar) más SVG propios (sombrero vueltiao, mariposas amarillas, destellos, chiva, cinta). Pueden rozar bordes y esquinas, **nunca** cubrir texto que informa, campos ni botones; máximo 6 por pantalla y 2 personajes; siempre `aria-hidden`, `loading="lazy"`, con `width` y `height`, y fuera del camino del LCP. **Las pantallas de administración no llevan personajes.**
- **El torcido es solo CSS:** el orden del DOM y el foco por teclado no cambian. Campos de formulario, párrafos, tablas y mapa nunca se giran.
- **Movimiento:** «pegado» al entrar y la chiva de la carga están activos por defecto; con `prefers-reduced-motion: reduce` quedan quietos.
- **Presupuestos que siguen vigentes:** LCP de `/rutas/buscar` < 2,5 s (mediana de 3 corridas), `main-*.js` ≤ 115 KB gzip (hoy ≈ 112,7), imágenes WebP/AVIF ≤ 40 KB, AA con axe en 0 violaciones, objetivos táctiles ≥ 44 px. **El CSS nuevo va en `src/styles.css`, no en los `styles` de los componentes** (esos viajan dentro del JS).
- **Créditos:** las fotos de personajes son CC BY-SA o CC BY y exigen atribución. Santiago decidió (2026-11-18) no publicar página de créditos; el texto está en `sustentacion/diseno-v2/ASSETS.md` §3 y la forma de cumplir la atribución sigue **pendiente** de su decisión.

## Testing

- Vitest (`ng test`), probando **comportamiento visible** al usuario, no detalles internos del componente.
- Prioridad: formularios (login, registro, comentarios) y la pantalla de búsqueda de ruta, incluyendo el cambio de endpoint online ↔ offline según la conectividad.
- Las llamadas HTTP se mockean a nivel de `services/`.

## Git y flujo de trabajo

- `main` protegida. Ramas `feature/SCRUM-N-nombre` o `fix/SCRUM-N-nombre`.
- **Pull Request obligatorio**, revisado por el otro integrante; nadie mergea su propio PR sin revisión. Es donde ambos aprenden el código del otro, que es justo lo que el docente busca.
- Conventional Commits en español con key de Jira: `feat(SCRUM-N): descripción`, `fix(SCRUM-N): descripción`, etc.
- **Ningún commit ni PR lleva atribución a Claude** (`Co-Authored-By: Claude...`, `Claude-Session: ...`, "Hecho por Claude" ni ninguna frase o alegoría equivalente). Regla general de los 3 repos, en el `CLAUDE.md` de la carpeta del curso, sección Git.
- CI en GitHub Actions: `ng build` + `ng test` en cada PR, más el job `lighthouse` (Lighthouse CI sobre `/rutas/buscar`, SCRUM-127) — todavía sin lint. Si el CI falla, no se mergea.
- Backlog en Jira; cada sustentación quincenal ante el comité cierra un hito.

## Convenciones de código

- Código y nombres de variables en **inglés**; comentarios, commits, issues, documentación y README en **español**. Los textos que ve el usuario van en español (es una app para Fusagasugá).
- Componentes **standalone** (sin `NgModule`), un componente por archivo, nombre en `PascalCase` + sufijo (`RouteSearchComponent`).
- Estado local con **signals** (`signal`, `computed`); RxJS solo donde el flujo es genuinamente asíncrono/reactivo (streams HTTP, eventos de conectividad) — no como reemplazo por defecto de un signal.
- Comentar solo el *por qué* no obvio. Lo que el código ya dice no se comenta.
- Sin librerías de UI ni gestor de estado global (NgRx, etc.) mientras no haga falta: primero signals + servicios inyectables, y solo se agrega una dependencia cuando haya un problema real que resolver. Cada dependencia hay que poder justificarla ante el comité.
- Formatear montos como pesos colombianos (COP).
