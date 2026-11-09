import { expect, test, Page } from '@playwright/test';

const WIDTHS = [320, 360, 390, 412];
const SCREENS: { name: string; path: string }[] = [
  { name: 'buscador', path: '/rutas/buscar' },
  { name: 'rutas', path: '/rutas' },
  { name: 'detalle', path: '/rutas/14' },
  { name: 'login', path: '/login' },
  { name: 'registro', path: '/registro' },
];

/** 17:10 en Bogotá: dentro de la franja simulada de trancón del Indio. */
const TARDE = new Date('2026-11-09T17:10:00-05:00');

interface Problem { kind: string; what: string }

/** Mide la página en el navegador: scroll horizontal, objetivos táctiles y textos cortados. */
async function audit(page: Page): Promise<Problem[]> {
  return page.evaluate(() => {
    const out: { kind: string; what: string }[] = [];
    const describe = (el: Element) => {
      const text = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || (el as HTMLInputElement).placeholder || '').trim().slice(0, 40);
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${text}"`;
    };
    if (document.documentElement.scrollWidth > window.innerWidth) {
      out.push({ kind: 'scroll-horizontal', what: `${document.documentElement.scrollWidth} > ${window.innerWidth}` });
    }
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden], [aria-hidden="true"]');
    };
    const interactive = document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="option"], [role="button"]');
    for (const el of Array.from(interactive)) {
      if (!visible(el)) continue;
      // Radios y checkboxes miden por su etiqueta, que es lo que se toca.
      const target = (el as HTMLInputElement).type === 'radio' || (el as HTMLInputElement).type === 'checkbox'
        ? el.closest('label') ?? el : el;
      const r = target.getBoundingClientRect();
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) {
        out.push({ kind: 'tactil<44', what: `${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}` });
      }
      if (el.tagName !== 'A' && (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1) {
        out.push({ kind: 'texto-cortado', what: describe(el) });
      }
    }
    return out;
  });
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const screen of SCREENS) {
      test(`${screen.name} sin desbordes`, async ({ page }, info) => {
        await page.goto(screen.path);
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: `e2e/capturas/${info.project.name}/${screen.name}-${width}.png`, fullPage: true });
        expect(await audit(page)).toEqual([]);
      });
    }

    test('flujo completo: ind → Indio, termi → Terminal, buscar', async ({ page }, info) => {
      await page.clock.setFixedTime(TARDE);
      await page.goto('/rutas/buscar');

      const origen = page.getByRole('combobox', { name: 'Origen' });
      await origen.fill('ind');
      await expect(page.getByRole('option', { name: '📍 Mi ubicación' })).toBeVisible();
      await page.getByRole('option', { name: /^Indio/ }).click();
      await expect(origen).toHaveValue('Indio');

      const destino = page.getByRole('combobox', { name: 'Destino' });
      await destino.fill('termi');
      await page.getByRole('option', { name: /Terminal de Transporte/ }).click();
      await expect(destino).toHaveValue('Terminal de Transporte');

      await expect(page.getByTestId('vista-previa')).toContainText('Origen: Indio');
      await expect(page.getByTestId('vista-previa')).toContainText('Destino: Terminal de Transporte');
      await page.screenshot({ path: `e2e/capturas/${info.project.name}/buscador-elegido-${width}.png`, fullPage: true });
      expect(await audit(page)).toEqual([]);

      await page.getByRole('button', { name: '¡Hágale!' }).click();
      const resultado = page.getByTestId('resultado');
      await expect(resultado).toBeVisible();
      await expect(resultado.getByRole('heading', { name: 'Busque este letrero' })).toBeVisible();
      await expect(page.getByTestId('tiempo')).toContainText('18');
      await expect(page.getByTestId('tiempo')).toContainText('con el tráfico de ahora');
      await expect(page.getByTestId('caminata')).toContainText('aprox. 312 m');
      await expect(page.getByTestId('aviso-congestion')).toContainText(/puede haber/i);
      await expect(page.getByTestId('mapa-resultado')).toBeVisible();
      await page.waitForTimeout(800); // deja terminar la entrada animada antes de la captura
      await page.screenshot({ path: `e2e/capturas/${info.project.name}/resultado-${width}.png`, fullPage: true });
      expect(await audit(page)).toEqual([]);
    });
  });
}
