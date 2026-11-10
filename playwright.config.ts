import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de responsive (RNF-07) contra `ng serve -c mock`: datos simulados del
 * contrato de lugares, sin backend ni clave de Google. Corre en Chromium y WebKit
 * (el motor de Safari en iPhone) a 320, 360, 390 y 412 px.
 */
const PORT = 4300;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], hasTouch: true, isMobile: false } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], hasTouch: true } },
  ],
  webServer: {
    command: `npx ng serve -c mock --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
