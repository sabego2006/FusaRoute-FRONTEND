'use strict';

// RNF-01 (SCRUM-127 / SCRUM-136): LCP < 2.5 s en Lighthouse mobile Slow 4G sobre la
// pantalla de resultado de búsqueda (/rutas/buscar). El umbral vive en budgets.json,
// versionado, para no duplicar el número acá y en el reporte nativo de Lighthouse.
const budgets = require('./budgets.json');

const lcpBudgetMs = budgets[0].timings.find((t) => t.metric === 'largest-contentful-paint').budget;

// http-server no sirve rutas de Angular por defecto (son solo archivos en disco); el
// truco "--proxy http://localhost:PUERTO?" hace que cualquier 404 (ej. /rutas/buscar)
// se re-resuelva contra index.html, que es como el SPA maneja esa URL en el navegador.
const PORT = 4300;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `npx http-server dist/fusaroute-frontend/browser -p ${PORT} --proxy http://localhost:${PORT}?`,
      startServerReadyPattern: 'Available on',
      url: [`http://localhost:${PORT}/rutas/buscar`],
      numberOfRuns: 3,
      settings: {
        formFactor: 'mobile',
        throttlingMethod: 'simulate',
        screenEmulation: { mobile: true, width: 375, height: 667, deviceScaleFactor: 2, disabled: false },
        // Estos son los valores por defecto de Lighthouse para mobile (los mismos que
        // el reporte etiqueta "Slow 4G throttling"); se dejan explícitos para que
        // alguien nuevo en Lighthouse los vea sin tener que conocer el default.
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 150 * 3.75,
          downloadThroughputKbps: 1638.4,
          uploadThroughputKbps: 750,
        },
        budgets,
      },
    },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: lcpBudgetMs }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
