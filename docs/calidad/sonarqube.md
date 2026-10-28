# Análisis estático del frontend (SonarQube)

Cierra el hook de **RNF-05** (analizador estático en CI en cada PR) y da soporte a la
métrica de mantenibilidad de ISO/IEC 25010. Tarjeta: **SCRUM-182**.

## Qué corre y cuándo

En cada Pull Request a `main` y en cada push a `main`, el workflow `ci.yml`:

1. `npm ci`
2. `npx ng build`
3. `npm run test:ci` — tests **con cobertura**
4. Análisis de SonarQube, que ingiere esa cobertura

## Las dos cosas que hay que saber

### La ruta del reporte de cobertura no es la obvia

El builder `@angular/build:unit-test` **no** escribe en `coverage/lcov.info`, como haría
Vitest suelto. Escribe bajo un subdirectorio con el nombre del proyecto:

```
coverage/fusaroute-frontend/lcov.info
```

Esa es la ruta que lleva `sonar.javascript.lcov.reportPaths`. Importa porque **si queda
mal, Sonar no falla**: reporta 0 % de cobertura en silencio, y nadie se entera hasta que
alguien mira el dashboard y se pregunta por qué no hay datos.

Si algún día cambia el nombre del proyecto en `angular.json`, hay que cambiar esta ruta.

### Dónde corre el análisis: SonarCloud en el CI, Docker en local

Hay **dos** instancias y cumplen propósitos distintos. No compiten:

| | SonarCloud | Docker local (`infra/sonarqube/` del backend) |
|---|---|---|
| Para qué | El análisis automático de cada PR (RNF-05) | Inspección local y demostrar el despliegue en contenedor |
| Quién lo ve | Cualquiera, por URL pública | Quien levante el contenedor, en `localhost:9000` |
| Cuándo corre | En cada PR y push a `main` | A mano, cuando se necesite |

El CI apunta **solo a SonarCloud**; la instancia Docker no participa del pipeline.

**Por qué SonarCloud para el CI:** ambos repos son públicos, así que el análisis es gratuito
e ilimitado e incluye *branch analysis* y decoración de PRs. La Community Edition
autohospedada **no** trae esas dos features — son de pago — así que Cloud cumple mejor el
RNF-05, que pide análisis en cada PR, y no obliga a mantener un servidor.

### El paso de Sonar se salta si no hay token

El workflow trae un guard:

```yaml
if: env.SONAR_TOKEN != ''
```

Sin el secret, el paso queda **SKIPPED, no FAILED**. Así el CI no se pone rojo mientras el
admin todavía no ha importado el repo. Es el mismo patrón que usa el backend (SCRUM-181).

**`SONAR_TOKEN` es el único secret.** El host **no** es un secret: va literal en el paso
como `SONAR_HOST_URL: https://sonarcloud.io`. Ponerlo en un secret sería peor — si quedara
vacío por olvido, la action caería a su default y el fallo sería silencioso. Siendo literal,
solo hay una cosa que el admin puede olvidar, y su ausencia se ve como paso SKIPPED.

## Configuración de cobertura

En `angular.json`, el target `test`:

```json
"coverageReporters": ["lcovonly", "text-summary"],
"coverageExclude": ["src/main.ts", "src/environments/**", "**/*.spec.ts"]
```

- `lcovonly` es lo que consume Sonar; `text-summary` imprime el resumen en el log del CI,
  que sirve para verlo sin entrar al dashboard.
- Las exclusiones son las mismas en `angular.json` y en `sonar.coverage.exclusions`. Si se
  tocan en un lado hay que tocarlas en el otro, o aparecerán archivos marcados como "0 %
  cubierto" que a propósito no se prueban.

Los nombres de estas opciones se confirmaron con `ng test --help`: el builder usa
`--coverage`, `--coverage-reporters` y `--coverage-exclude`.

## Cobertura al momento de integrar

```
Statements   : 87.14 % (827/949)
Branches     : 82.33 % (317/385)
Functions    : 77.34 % (99/128)
Lines        : 90.81 % (603/664)
```

**No hay umbral bloqueante todavía.** El Quality Gate es informativo: se reporta en el PR
pero no impide el merge. Cuando el equipo acuerde los umbrales, se agrega
`sonar.qualitygate.wait=true` al paso de análisis.

## Lo que falta (lo hace el admin)

1. Importar `sabego2006/FusaRoute-FRONTEND` en SonarQube Cloud.
2. **Desactivar Automatic Analysis** — si queda activo, choca con el análisis del CI y
   SonarCloud rechaza uno de los dos.
3. Generar el token y guardarlo como secret `SONAR_TOKEN` del repositorio.
4. Verificar que `sonar.organization` en `sonar-project.properties` coincide con la
   organización real. Está puesto como `sabego2006`, que es lo convencional, pero si no
   coincide el análisis falla con *project not found*.

`SONAR_HOST_URL` solo hace falta si se usa una instancia propia en vez de la nube; vacío,
la action apunta a SonarQube Cloud.

## Nota sobre el hosting

El backend (SCRUM-181) quedó con **SonarQube autohospedado** y el frontend se decidió en
**SonarQube Cloud**. Funciona, pero deja los dos repos en dashboards distintos y duplica la
administración. Vale la pena decidir si se unifican antes de la sustentación.
