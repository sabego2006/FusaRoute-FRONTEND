# Pruebas E2E del administrador (SCRUM-23, 24, 25, 26)

Suite de Playwright en `e2e/admin.spec.ts` (etiqueta `@admin`). Comprueba en navegador real que el rol
ADMIN funciona (comentarios, rutas, suspensiones, métricas) y que un usuario normal queda fuera.

**Solo corre contra el backend local con perfil dev** (base DEV compartida). Nunca contra PROD, Render
ni Vercel: `e2e/support/guardia.ts` aborta si `E2E_API_URL` contiene `onrender.com`, `vercel.app`,
`supabase.co`, el host de `PROD_HOST` o cualquier host que no sea localhost.

## Variables requeridas

| Variable | Qué es |
|---|---|
| `ADMIN_EMAIL` | correo del admin de DEV |
| `ADMIN_PASSWORD` | contraseña |
| `ADMIN_TOTP_SECRET` | secreto TOTP en base32 (nunca se imprime ni se commitea) |
| `E2E_API_URL` | opcional, por defecto `http://localhost:8080` |

Alternativa: un archivo `.admin.local.json` en la raíz (ignorado por git):
`{ "email": "...", "password": "...", "totpSecret": "..." }`. Santiago lo entrega por canal privado.
Si faltan, **toda la suite se salta** con un mensaje claro (no falla).

## Cómo correrla

1. Backend local con perfil dev (carpeta `FusaRoute-BACKEND`, con su `.env`, `SPRING_PROFILE=dev`):
   `cmd.exe //c "mvnw spring-boot:run"` (o el comando habitual del backend). Debe responder en `localhost:8080`.
2. Frontend: la config levanta sola `ng serve` en el puerto 4301 (o reutiliza uno ya abierto).
3. Suite:

```bash
node node_modules/@playwright/test/cli.js test -c playwright.admin.config.ts --grep @admin
```

En esta máquina `node` es el de Program Files; si el de `~/bin` rompe Playwright, usa `/c/nvm4w/nodejs/node.exe` en su lugar. Alternativa: `cmd.exe //c "npx playwright test -c playwright.admin.config.ts --grep @admin"`.
(`e2e/support/totp.spec.ts` verifica el generador TOTP contra los vectores de RFC 6238 y no necesita credenciales.)

## Qué deja en DEV

- Datos con prefijo `ZZ-PRUEBA-E2E-<fecha>`.
- Rutas de prueba: terminan **INACTIVAS** (no hay borrado físico).
- Usuarios de prueba (`zz-prueba-e2e-*@example.com`) y comentarios respondidos: no tienen borrado, quedan registrados.

## Si algo falla

- *Se salta todo*: faltan credenciales.
- *GUARDIA*: `E2E_API_URL` apunta a un host no local; corrígelo, no lo evites.
- *Login por API falla*: revisa el secreto TOTP y el reloj del equipo (deriva > 30 s rompe el código).
- *Error de conexión*: el backend local no está arriba en `:8080` o falta su `.env`.
- Trazas y capturas de los fallos quedan en `test-results/` (`npx playwright show-trace <zip>`).
- Un fallo por código del producto se reporta como bug; no se debilita la aserción.

## CI

El CI no ejecuta Playwright; además `playwright.config.ts` ignora `admin.spec.ts`, así que `npm run e2e:responsive`
no la toca.
