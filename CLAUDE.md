# FusaRoute — Frontend

Interfaz web del sistema de información de transporte público de Fusagasugá. Proyecto Integrador de Ingeniería de Software I, Universidad de Cundinamarca (docente: Ing. Luiferney Ortiz Parra).

**Recursos externos:** la carpeta del curso en OneDrive (`C:/Users/Santiago/OneDrive - UNIVERSIDAD DE CUNDINAMARCA/Universidad/5 SEMESTRE/INGENIERIA SOFTWARE I`) contiene la Actividad 3 v3 y el material de clase. Las historias de usuario grilladas (RF-01 a RF-09, con criterios de aceptación) están en `docs/backlog/historias-rf01-rf09.md` de esa misma carpeta — es la fuente de las reglas de negocio de este archivo.

El contexto completo del curso, el alcance del proyecto y las métricas de calidad comprometidas están en el `CLAUDE.md` de la carpeta madre de la asignatura.

**Equipo:** Santiago Bermúdez · Angélica Aranguren. Ambos trabajan todo el stack por exigencia del docente. Es la primera vez del equipo con Angular, así que las convenciones de este archivo se explican, no solo se enuncian.

## Stack

- Angular 18 + **TypeScript**, con Angular CLI
- Angular Router para navegación
- Google Maps JavaScript API para visualizar rutas y paradas
- Jasmine + Karma (test runner por defecto de Angular) o Jest si se justifica

## Responsabilidad del frontend

El frontend **presenta y captura**, no decide. Concretamente:

- Interacción con el usuario y formularios (login, registro, búsqueda de ruta, caja de comentarios).
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
| Usabilidad | flujo principal (buscar ruta) en máximo **4 acciones** sin contar login | recorrido manual del flujo + prueba con ≥ 5 usuarios externos al equipo |
| Rendimiento | LCP < 2.5 s en Lighthouse mobile Slow 4G sobre la pantalla de resultado de búsqueda | Lighthouse en CI en cada Pull Request |
| Mantenibilidad | 0 llamadas HTTP fuera de `services/`; sin `any` | revisión en PR |
| Accesibilidad | HTML semántico, formularios con `<label>`, navegable por teclado | revisión en PR |

Pensado para móvil: la mayoría de usuarios consultará la ruta desde el celular en la calle. Diseño responsive desde el inicio, no adaptado al final.

## Testing

- Test runner de Angular (Jasmine + Karma) o Jest si se justifica, probando **comportamiento visible** al usuario, no detalles internos del componente.
- Prioridad: formularios (login, registro, comentarios) y la pantalla de búsqueda de ruta, incluyendo el cambio de endpoint online ↔ offline según la conectividad.
- Las llamadas HTTP se mockean a nivel de `services/`.

## Git y flujo de trabajo

- `main` protegida. Ramas `feature/SCRUM-N-nombre` o `fix/SCRUM-N-nombre`.
- **Pull Request obligatorio**, revisado por el otro integrante; nadie mergea su propio PR sin revisión. Es donde ambos aprenden el código del otro, que es justo lo que el docente busca.
- **Bloque de ejecución manual por sprint:** cada integrante resuelve al menos una Subtask propia sin que un agente escriba el código ni corra el comando — Claude puede guiar, no ejecutar. El commit de esa Subtask no lleva `Co-Authored-By: Claude` (regla completa en el `CLAUDE.md` de la carpeta del curso).
- Conventional Commits en español con key de Jira: `feat(SCRUM-N): descripción`, `fix(SCRUM-N): descripción`, etc.
- CI en GitHub Actions: build + lint + tests en cada PR. Si el CI falla, no se mergea.
- Backlog en Jira; cada sustentación quincenal ante el comité cierra un hito.

## Convenciones de código

- Código y nombres de variables en **inglés**; comentarios, commits, issues, documentación y README en **español**. Los textos que ve el usuario van en español (es una app para Fusagasugá).
- Componentes en `PascalCase`, hooks con prefijo `use`, un componente por archivo.
- Componentes de función con hooks; sin componentes de clase.
- Comentar solo el *por qué* no obvio. Lo que el código ya dice no se comenta.
- Sin librerías de UI ni gestores de estado global mientras no haga falta: primero `useState` y contexto, y solo se agrega una dependencia cuando haya un problema real que resolver. Cada dependencia hay que poder justificarla ante el comité.
- Formatear montos como pesos colombianos (COP).
