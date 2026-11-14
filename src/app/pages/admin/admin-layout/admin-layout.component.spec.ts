import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ADMIN_SECTIONS, AdminLayoutComponent } from './admin-layout.component';

@Component({ standalone: true, template: '<p>pantalla de comentarios</p>' })
class CommentsStubComponent {}

/**
 * Armazón de administración (SCRUM-23).
 *
 * Se monta con el router de verdad y una pantalla hija de mentira: lo que se prueba es
 * la navegación del armazón, no el panel de comentarios, que tiene su propio spec. Los
 * guards tampoco entran aquí (ver `admin.guard.spec.ts`).
 */
describe('AdminLayoutComponent', () => {
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'admin',
            component: AdminLayoutComponent,
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'comentarios' },
              { path: 'comentarios', component: CommentsStubComponent },
              { path: '**', redirectTo: 'comentarios' },
            ],
          },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  async function abrir(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    harness.detectChanges();
    root = (harness.fixture as ComponentFixture<unknown>).nativeElement as HTMLElement;
  }

  function entrada(etiqueta: string): HTMLElement | undefined {
    return Array.from(root.querySelectorAll<HTMLElement>('.fr-admin__item'))
      .find((el) => (el.textContent ?? '').includes(etiqueta));
  }

  it('muestra las cuatro secciones, en orden', async () => {
    await abrir('/admin/comentarios');

    const etiquetas = Array.from(root.querySelectorAll('.fr-admin__item'))
      .map((el) => (el.textContent ?? '').replace('Próximamente', '').trim());
    expect(etiquetas).toEqual(['Comentarios', 'Rutas', 'Suspensiones', 'Métricas']);
  });

  it('la navegación tiene nombre accesible', async () => {
    await abrir('/admin/comentarios');

    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Secciones de administración');
  });

  it('/admin sin sección redirige a comentarios', async () => {
    await abrir('/admin');

    expect(TestBed.inject(Router).url).toBe('/admin/comentarios');
    expect(root.textContent).toContain('pantalla de comentarios');
  });

  it('Comentarios es un enlace a /admin/comentarios', async () => {
    await abrir('/admin/comentarios');

    const comentarios = entrada('Comentarios');
    expect(comentarios?.tagName).toBe('A');
    expect(comentarios?.getAttribute('href')).toBe('/admin/comentarios');
  });

  /** `aria-current` es lo que le dice al lector de pantalla en qué sección se está. */
  it('la sección abierta lleva aria-current="page" y es la única', async () => {
    await abrir('/admin/comentarios');

    expect(entrada('Comentarios')?.getAttribute('aria-current')).toBe('page');
    expect(root.querySelectorAll('[aria-current]').length).toBe(1);
  });

  /**
   * Una sección que aún no existe no puede ser un enlace: recibiría el foco del
   * teclado para no llevar a ninguna parte.
   */
  it('las secciones que aún no existen salen deshabilitadas, con "Próximamente" y sin enlace', async () => {
    await abrir('/admin/comentarios');

    for (const etiqueta of ['Métricas']) {
      const el = entrada(etiqueta);
      expect(el?.tagName, etiqueta).toBe('SPAN');
      expect(el?.getAttribute('aria-disabled'), etiqueta).toBe('true');
      expect(el?.hasAttribute('href'), etiqueta).toBe(false);
      expect(el?.hasAttribute('tabindex'), etiqueta).toBe(false);
      expect(el?.textContent, etiqueta).toContain('Próximamente');
    }
  });

  /** Rutas se activó con la gestión de rutas (SCRUM-24): ya es enlace y sin etiqueta. */
  /** Suspensiones se activó con RF-12 (SCRUM-25): ya es enlace y sin etiqueta. */
  it('Suspensiones es un enlace a /admin/suspensiones y ya no dice "Próximamente"', async () => {
    await abrir('/admin/comentarios');

    const susp = entrada('Suspensiones');
    expect(susp?.tagName).toBe('A');
    expect(susp?.getAttribute('href')).toBe('/admin/suspensiones');
    expect(susp?.textContent).not.toContain('Próximamente');
  });

  it('Rutas es un enlace a /admin/rutas y ya no dice "Próximamente"', async () => {
    await abrir('/admin/comentarios');

    const rutas = entrada('Rutas');
    expect(rutas?.tagName).toBe('A');
    expect(rutas?.getAttribute('href')).toBe('/admin/rutas');
    expect(rutas?.textContent).not.toContain('Próximamente');
  });

  it('la sección disponible no lleva la etiqueta "Próximamente"', async () => {
    await abrir('/admin/comentarios');

    expect(entrada('Comentarios')?.textContent).not.toContain('Próximamente');
  });

  it('solo los enlaces de secciones disponibles entran en el orden del tabulador', async () => {
    await abrir('/admin/comentarios');

    const enfocables = root.querySelectorAll('nav a[href], nav button, nav [tabindex]');
    expect(enfocables.length).toBe(ADMIN_SECTIONS.filter((s) => s.available).length);
  });

  /** Entrar por URL a una sección sin construir no saca al administrador del armazón. */
  it('una sección que aún no existe cae en comentarios', async () => {
    await abrir('/admin/metricas');

    expect(TestBed.inject(Router).url).toBe('/admin/comentarios');
  });
});
