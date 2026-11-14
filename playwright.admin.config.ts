import { defineConfig, devices } from '@playwright/test';
import { assertBackendLocal } from './e2e/support/guardia';

/**
 * Suite E2E del administrador (SCRUM-23..26): navegador real contra `ng serve` (ambiente DEV,
 * apiUrl http://localhost:8080) y el backend LOCAL con perfil dev. Necesita credenciales de
 * DEV, por eso NO corre en CI. Ver docs/pruebas-e2e-admin.md.
 */
assertBackendLocal(); // aborta si E2E_API_URL apunta a un host desplegado

const PORT = 4301;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['admin.spec.ts', 'support/totp.spec.ts'],
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env['CI'],
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
