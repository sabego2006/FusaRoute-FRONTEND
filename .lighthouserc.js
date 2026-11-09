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
const DIST_DIR = 'dist/fusaroute-frontend/browser';

// http-server no comprime al vuelo: sin esto servia cada archivo en crudo (p. ej. el
// chunk inicial mas pesado en ~162kB) mientras que Vercel (donde corre de verdad) los
// manda con gzip/brotli (~47kB ese mismo chunk) — bajo el Slow 4G simulado, esa
// diferencia de payload por si sola ya volaba el presupuesto de LCP sin que el cambio
// tuviera nada que ver con el peso real de la app. precomprimimos a .gz (-k conserva el
// original para rutas que no son texto) y `--gzip` hace que http-server sirva el .gz
// con el Content-Encoding correcto cuando el cliente lo acepta.
const PRECOMPRESS = `find ${DIST_DIR} -type f \\( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.webmanifest" -o -name "routes" -o -name "places" \\) -exec gzip -9 -k -f {} \\;`;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `${PRECOMPRESS} && npx http-server ${DIST_DIR} -p ${PORT} --gzip --proxy http://localhost:${PORT}?`,
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
