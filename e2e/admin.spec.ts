import { expect, Page, test } from '@playwright/test';
import { api, createNormalUser, loginAdmin, PREFIX, Session } from './support/api';
import { loadAdminCredentials, SKIP_REASON } from './support/credenciales';
import { assertBackendLocal } from './support/guardia';

/**
 * E2E del administrador (SCRUM-23, 24, 25, 26). Corre contra el backend LOCAL con perfil dev
 * (base DEV compartida), nunca contra PROD. Ver docs/pruebas-e2e-admin.md.
 *
 * Todo dato de prueba lleva el prefijo ZZ-PRUEBA-E2E-<fecha>. Las rutas de prueba terminan
 * INACTIVAS (no hay borrado físico); los usuarios de prueba no tienen borrado y quedan registrados.
 */
const cred = loadAdminCredentials();

// Trazado de prueba y coordenadas que lo recorren (lat/lng del buscador público).
const PATH = { type: 'LineString', coordinates: [[-74.37, 4.34], [-74.36, 4.35]] };
const SEARCH = 'originLat=4.34&originLng=-74.37&destinationLat=4.35&destinationLng=-74.36';

interface RouteSummary { id: number; name: string; status: string; currentFare: number | null }
interface CommentDto { id: number; text: string; status: string; reply?: string | null }

/** Deja la sesión ya iniciada en el navegador, como lo haría el login (token + usuario). */
async function openAs(page: Page, s: Session): Promise<void> {
  await page.addInitScript((session) => {
    localStorage.setItem('token', session.token);
    localStorage.setItem('expiresAt', session.expiresAt);
    localStorage.setItem('user', JSON.stringify(session.user));
  }, s);
}

function uniqueName(tag: string): string {
  return `${PREFIX()}-${tag}-${Date.now().toString(36)}`;
}

async function findRoute(admin: Session, name: string): Promise<RouteSummary | undefined> {
  const r = await api<RouteSummary[]>('GET', '/api/admin/routes', { token: admin.token });
  return r.body.find((x) => x.name === name);
}

/** Crea una ruta de prueba por API (para los escenarios que no ejercitan el formulario). */
async function createRouteViaApi(admin: Session, name: string): Promise<number> {
  const r = await api<{ id: number }>('POST', '/api/admin/routes', {
    token: admin.token,
    body: {
      name, type: 'URBANA', pathGeoJson: PATH,
      neighborhoods: ['ZZ-PRUEBA-E2E Uno', 'ZZ-PRUEBA-E2E Dos'],
      fares: [{ amount: 2500 }],
    },
  });
  expect(r.status, 'crear ruta de prueba por API').toBe(201);
  return r.body.id;
}

/** Limpieza: deja la ruta INACTIVA (si ya lo estaba, el backend puede responder 404/409: se ignora). */
async function deactivate(admin: Session, name: string): Promise<void> {
  const route = await findRoute(admin, name);
  if (route && route.status !== 'INACTIVA') {
    await api('DELETE', `/api/admin/routes/${route.id}`, { token: admin.token });
  }
}

/** Instante actual en Bogotá con el formato de <input type="datetime-local">. */
function bogotaLocal(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(d);
  return parts.replace(' ', 'T');
}

test.describe('Administrador', { tag: '@admin' }, () => {
  test.skip(!cred, SKIP_REASON);
  test.beforeAll(() => assertBackendLocal());

  let admin: Session;
  test.beforeAll(async () => { admin = await loginAdmin(cred!); });

  test.describe('Acceso', () => {
    test('un usuario normal no ve "Administración" y /admin/comentarios lo redirige', async ({ page }) => {
      const user = await createNormalUser();
      await openAs(page, user.session);
      await page.goto('/rutas/buscar');
      await expect(page.getByRole('link', { name: 'Administración' })).toHaveCount(0);
      await page.goto('/admin/comentarios');
      await expect(page).toHaveURL(/\/rutas\/buscar$/);
      await expect(page.getByRole('heading', { name: 'Comentarios de los usuarios' })).toHaveCount(0);
    });

    test('el admin ve "Administración" y entra al panel', async ({ page }) => {
      await openAs(page, admin);
      await page.goto('/rutas/buscar');
      await page.getByRole('link', { name: 'Administración' }).click();
      await expect(page).toHaveURL(/\/admin\/comentarios$/);
      await expect(page.getByRole('heading', { name: 'Comentarios de los usuarios' })).toBeVisible();
    });

    test('GET /api/admin/comments: 403 con token de usuario normal y 401 sin token', async () => {
      const user = await createNormalUser();
      expect((await api('GET', '/api/admin/comments', { token: user.session.token })).status).toBe(403);
      expect((await api('GET', '/api/admin/comments')).status).toBe(401);
    });
  });

  test.describe('Comentarios (SCRUM-23)', () => {
    test('el admin responde un comentario pendiente y el usuario lo ve respondido sin poder editarlo', async ({ browser }) => {
      const user = await createNormalUser();
      const text = `[PRUEBA E2E] ${PREFIX()} ${Date.now() % 100000}`;
      const created = await api<CommentDto>('POST', '/api/comments', { token: user.session.token, body: { text } });
      expect(created.status).toBe(201);
      const id = created.body.id;

      const adminCtx = await browser.newContext();
      const adminPage = await adminCtx.newPage();
      await openAs(adminPage, admin);
      await adminPage.goto('/admin/comentarios');
      const row = adminPage.locator('li.fr-comentario').filter({ hasText: text });
      await expect(row).toBeVisible();
      await expect(row.locator('.fr-chip')).toHaveText('Pendiente');
      await row.getByRole('button', { name: 'Responder' }).click();
      await row.locator(`#respuesta-${id}`).fill('Gracias por tu mensaje, prueba automática E2E.');
      await row.getByRole('button', { name: 'Guardar respuesta' }).click();
      await adminPage.getByRole('button', { name: 'Respondidos' }).click();
      const answered = adminPage.locator('li.fr-comentario').filter({ hasText: text });
      await expect(answered.locator('.fr-chip')).toHaveText('Respondido');
      await adminCtx.close();

      const userCtx = await browser.newContext();
      const userPage = await userCtx.newPage();
      await openAs(userPage, user.session);
      await userPage.goto('/comentarios');
      const mine = userPage.locator('li.fr-comentario').filter({ hasText: text });
      await expect(mine.locator('.fr-chip')).toHaveText('Respondido');
      await expect(mine.getByRole('button', { name: 'Editar' })).toHaveCount(0);
      await userCtx.close();

      const edit = await api('PUT', `/api/comments/${id}`, { token: user.session.token, body: { text: `${text} editado` } });
      expect(edit.status, 'editar un comentario respondido debe rechazarse').toBeGreaterThanOrEqual(400);
      expect(edit.status).toBeLessThan(500);
    });
  });

  test.describe('Rutas (SCRUM-24)', () => {
    test('crear con trazado, editar tarifa, eliminar (INACTIVA), restaurar y dejar INACTIVA', async ({ page }) => {
      const name = uniqueName('ruta');
      try {
        await openAs(page, admin);

        await page.goto('/admin/rutas/nueva');
        await page.getByLabel('Nombre de la ruta').fill(name);
        for (const barrio of ['ZZ-PRUEBA-E2E Uno', 'ZZ-PRUEBA-E2E Dos']) {
          await page.getByLabel('Nuevo barrio').fill(barrio);
          await page.getByRole('button', { name: 'Agregar barrio' }).click();
        }
        await page.getByLabel('Valor del pasaje (COP)').fill('2500');
        await page.getByLabel('Trazado GeoJSON (opcional)').fill(JSON.stringify(PATH));
        await page.getByRole('button', { name: 'Crear ruta' }).click();
        await expect(page).toHaveURL(/\/admin\/rutas$/);

        const row = page.locator('tbody tr').filter({ hasText: name });
        await expect(row).toBeVisible();
        await expect(row.locator('.fr-estado')).toHaveText('Activa');

        await page.goto('/rutas');
        await expect(page.getByText(name).first()).toBeVisible();

        await page.goto('/admin/rutas');
        await page.getByLabel('Buscar por nombre').fill(name);
        await page.getByRole('link', { name: `Editar la ruta ${name}` }).click();
        await page.getByLabel('Valor del pasaje (COP)').fill('3000');
        await page.getByRole('button', { name: 'Guardar cambios' }).click();
        await expect(page).toHaveURL(/\/admin\/rutas$/);
        await page.getByLabel('Buscar por nombre').fill(name);
        await expect(page.locator('tbody tr').filter({ hasText: name })).toContainText(/3\.?000/);

        await page.getByRole('button', { name: `Eliminar la ruta ${name}` }).click();
        await page.getByRole('button', { name: 'Sí, eliminar' }).click();
        await expect(page.locator('tbody tr').filter({ hasText: name }).locator('.fr-estado')).toHaveText('Inactiva');

        await page.goto('/rutas');
        await expect(page.getByText(name)).toHaveCount(0);

        await page.goto('/admin/rutas');
        await page.getByLabel('Buscar por nombre').fill(name);
        await page.getByRole('button', { name: `Restaurar la ruta ${name}` }).click();
        await expect(page.locator('tbody tr').filter({ hasText: name }).locator('.fr-estado')).toHaveText('Activa');
      } finally {
        await deactivate(admin, name);
      }
    });
  });

  test.describe('Suspensiones (SCRUM-25)', () => {
    test('suspender 10 min saca la ruta del buscador público y Reactivar la devuelve', async ({ page }) => {
      const user = await createNormalUser();
      const name = uniqueName('susp');
      try {
        const routeId = await createRouteViaApi(admin, name);
        const search = () => api<{ route?: { id: number } }>('GET', `/api/routes/search?${SEARCH}`, { token: user.session.token });

        const before = await search();
        expect(before.status).toBe(200);
        expect(before.body.route?.id).toBe(routeId);

        await openAs(page, admin);
        await page.goto('/admin/suspensiones');
        await page.getByLabel('Ruta', { exact: true }).selectOption({ label: name });
        await page.getByLabel('Inicio (hora de Colombia)').fill(bogotaLocal(0));
        await page.getByLabel('Fin (hora de Colombia)').fill(bogotaLocal(10));
        await page.getByLabel('Motivo (opcional)').fill('ZZ-PRUEBA-E2E');
        await page.getByRole('button', { name: /^Suspender/ }).click();
        await expect(page.getByRole('button', { name: `Reactivar la ruta ${name}` })).toBeVisible();

        const during = await search();
        expect(during.body.route?.id, 'la ruta suspendida no debe ofrecerse').not.toBe(routeId);

        await page.getByRole('button', { name: `Reactivar la ruta ${name}` }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: /Reactivar/ }).click();
        await expect(page.getByRole('button', { name: `Reactivar la ruta ${name}` })).toHaveCount(0);

        const after = await search();
        expect(after.body.route?.id).toBe(routeId);
      } finally {
        await deactivate(admin, name);
      }
    });
  });

  test.describe('Métricas (SCRUM-26)', () => {
    test('el panel muestra las 5 métricas y una búsqueda real sube "Búsquedas de hoy" en 1', async ({ page }) => {
      const user = await createNormalUser();
      const name = uniqueName('metr');
      try {
        await createRouteViaApi(admin, name);
        await openAs(page, admin);
        await page.goto('/admin/metricas');

        for (const titulo of ['Usuarios registrados', 'Búsquedas de hoy', 'Comentarios pendientes', 'Suspensiones activas', 'Las 5 rutas más consultadas']) {
          await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
        }

        const valor = async () => {
          const txt = await page.locator('section', { has: page.getByRole('heading', { name: 'Búsquedas de hoy' }) })
            .locator('.fr-metricas__valor').innerText();
          return Number(txt.replace(/\D/g, ''));
        };
        const antes = await valor();

        const s = await api('GET', `/api/routes/search?${SEARCH}`, { token: user.session.token });
        expect(s.status).toBe(200);

        await page.getByRole('button', { name: 'Recargar' }).click();
        await expect.poll(valor).toBe(antes + 1);
      } finally {
        await deactivate(admin, name);
      }
    });
  });
});

