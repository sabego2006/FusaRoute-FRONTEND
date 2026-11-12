import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdminRoutesComponent } from './admin-routes.component';
import { ToastService } from '../../../components/toast/toast.service';
import { AdminRouteSummary } from '../../../models/admin-route.model';
import { environment } from '../../../../environments/environment';

describe('AdminRoutesComponent', () => {
  let http: HttpTestingController;
  let toast: ToastService;
  let fixture: ComponentFixture<AdminRoutesComponent>;
  let root: HTMLElement;

  const url = `${environment.apiUrl}/api/admin/routes`;

  const activa: AdminRouteSummary = {
    id: 1, name: 'Centro - Terminal', type: 'URBANA', status: 'ACTIVA', hasPath: true,
    neighborhoodsCount: 5, currentFare: 2600, updatedAt: '2026-11-10T15:00:00-05:00',
  };
  const suspendida: AdminRouteSummary = {
    id: 2, name: 'Arbeláez', type: 'INTERMUNICIPAL', status: 'SUSPENDIDA', hasPath: false,
    neighborhoodsCount: 12, currentFare: 7000, updatedAt: '2026-11-09T09:00:00-05:00',
  };
  const inactiva: AdminRouteSummary = {
    id: 3, name: 'Pasca', type: 'INTERMUNICIPAL', status: 'INACTIVA', hasPath: true,
    neighborhoodsCount: 8, currentFare: null, updatedAt: '2026-11-08T09:00:00-05:00',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRoutesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => http.verify());

  async function abrir(rutas: AdminRouteSummary[] = [activa, suspendida, inactiva]): Promise<void> {
    fixture = TestBed.createComponent(AdminRoutesComponent);
    fixture.detectChanges();
    http.expectOne(url).flush(rutas);
    await fixture.whenStable();
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function filas(): string[] {
    return Array.from(root.querySelectorAll('tbody tr')).map(
      (tr) => (tr.querySelector('th')?.textContent ?? '').trim(),
    );
  }

  function boton(texto: string, dentroDe: ParentNode = root): HTMLButtonElement {
    const found = Array.from(dentroDe.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => (b.textContent ?? '').trim() === texto);
    if (!found) throw new Error(`No hay botón "${texto}"`);
    return found;
  }

  function escribirBusqueda(texto: string): void {
    const input = root.querySelector<HTMLInputElement>('#buscar-ruta')!;
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function filaDe(nombre: string): HTMLElement {
    return Array.from(root.querySelectorAll<HTMLElement>('tbody tr'))
      .find((tr) => (tr.querySelector('th')?.textContent ?? '').trim() === nombre)!;
  }

  /** Atiende la recarga que sigue a una acción. */
  function recargar(rutas: AdminRouteSummary[]): TestRequest {
    const req = http.expectOne(url);
    req.flush(rutas);
    return req;
  }

  it('lista todas las rutas, inactivas incluidas, con el estado como texto', async () => {
    await abrir();

    expect(filas()).toEqual(['Centro - Terminal', 'Arbeláez', 'Pasca']);
    const estados = Array.from(root.querySelectorAll('.fr-estado')).map((e) => (e.textContent ?? '').trim());
    expect(estados).toEqual(['Activa', 'Suspendida', 'Inactiva']);
  });

  it('muestra la tarifa actual en pesos o "Sin tarifa", y la fecha de actualización', async () => {
    await abrir();

    expect(filaDe('Centro - Terminal').textContent).toMatch(/2\.600/);
    expect(filaDe('Pasca').textContent).toContain('Sin tarifa');
    expect(filaDe('Centro - Terminal').querySelector('[data-label="Actualizada"]')?.textContent?.trim()).not.toBe('');
  });

  it('cada celda lleva su encabezado en data-label para pasar a tarjetas en pantalla angosta', async () => {
    await abrir();

    const etiquetas = Array.from(filaDe('Pasca').querySelectorAll('[data-label]')).map((c) => c.getAttribute('data-label'));
    expect(etiquetas).toEqual(['Nombre', 'Tipo', 'Estado', 'Tarifa actual', 'Actualizada', 'Acciones']);
  });

  it('busca por nombre sin importar mayúsculas ni tildes', async () => {
    await abrir();

    escribirBusqueda('ARBELAEZ');

    expect(filas()).toEqual(['Arbeláez']);
  });

  it('filtra por estado y vuelve a mostrar todas con "Todas"', async () => {
    await abrir();

    boton('Inactivas').click();
    fixture.detectChanges();
    expect(filas()).toEqual(['Pasca']);
    expect(boton('Inactivas').getAttribute('aria-pressed')).toBe('true');

    boton('Todas').click();
    fixture.detectChanges();
    expect(filas()).toHaveLength(3);
  });

  it('el filtro y la búsqueda se combinan', async () => {
    await abrir();

    boton('Activas').click();
    escribirBusqueda('pasca');

    expect(filas()).toEqual([]);
    expect(root.textContent).toContain('Ninguna ruta coincide');
  });

  it('Restaurar aparece solo en las INACTIVAS, y Eliminar solo en las demás', async () => {
    await abrir();

    expect(filaDe('Pasca').textContent).toContain('Restaurar');
    expect(filaDe('Pasca').textContent).not.toContain('Eliminar');
    expect(filaDe('Centro - Terminal').textContent).toContain('Eliminar');
    expect(filaDe('Centro - Terminal').textContent).not.toContain('Restaurar');
  });

  it('Editar es un enlace a la pantalla de edición de esa ruta', async () => {
    await abrir();

    const enlace = filaDe('Arbeláez').querySelector('a')!;
    expect(enlace.getAttribute('href')).toBe('/2/editar');
    expect(enlace.getAttribute('aria-label')).toContain('Arbeláez');
  });

  it('Crear ruta es un enlace a la pantalla de alta', async () => {
    await abrir();

    const crear = Array.from(root.querySelectorAll('a')).find((a) => a.textContent?.includes('Crear ruta'))!;
    expect(crear.getAttribute('href')).toBe('/nueva');
  });

  it('Eliminar pide confirmación que dice que es reversible y no borra todavía', async () => {
    await abrir();

    boton('Eliminar').click();
    fixture.detectChanges();

    const aviso = root.querySelector('[role="alertdialog"]')!;
    expect(aviso.textContent).toContain('Es reversible');
    expect(aviso.textContent).toContain('INACTIVA');
    expect(aviso.textContent).toContain('Centro - Terminal');
    http.expectNone(`${url}/1`);
  });

  it('Cancelar cierra la confirmación sin llamar al backend', async () => {
    await abrir();
    boton('Eliminar').click();
    fixture.detectChanges();

    boton('Cancelar', root.querySelector('[role="alertdialog"]')!).click();
    fixture.detectChanges();

    expect(root.querySelector('[role="alertdialog"]')).toBeNull();
    http.expectNone(`${url}/1`);
  });

  it('al abrirse la confirmación el foco queda en Cancelar', async () => {
    await abrir();
    document.body.appendChild(root);

    boton('Eliminar').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement?.textContent?.trim()).toBe('Cancelar');
    root.remove();
  });

  it('confirmar manda DELETE, avisa y recarga: la ruta sigue en la lista como INACTIVA', async () => {
    await abrir();
    boton('Eliminar').click();
    fixture.detectChanges();

    boton('Sí, eliminar').click();
    const del = http.expectOne(`${url}/1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    recargar([{ ...activa, status: 'INACTIVA' }, suspendida, inactiva]);
    fixture.detectChanges();

    expect(toast.current()?.message).toContain('inactiva');
    expect(root.querySelector('[role="alertdialog"]')).toBeNull();
    expect(filas()).toContain('Centro - Terminal');
    expect((filaDe('Centro - Terminal').querySelector('.fr-estado')?.textContent ?? '').trim()).toBe('Inactiva');
  });

  it('Restaurar manda POST /restore y recarga', async () => {
    await abrir();

    boton('Restaurar').click();
    const req = http.expectOne(`${url}/3/restore`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...inactiva, status: 'ACTIVA' });
    recargar([activa, suspendida, { ...inactiva, status: 'ACTIVA' }]);
    fixture.detectChanges();

    expect(toast.current()?.message).toContain('restaurada');
    expect((filaDe('Pasca').querySelector('.fr-estado')?.textContent ?? '').trim()).toBe('Activa');
  });

  it('un 409 al restaurar muestra el detalle del backend en un alert', async () => {
    await abrir();

    boton('Restaurar').click();
    http.expectOne(`${url}/3/restore`).flush(
      { status: 409, detail: 'Ya existe otra ruta activa con ese nombre.' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    const alerta = root.querySelector('.fr-alerta[role="alert"]');
    expect(alerta?.textContent).toContain('Ya existe otra ruta activa');
  });

  it('un 404 al eliminar avisa y recarga la lista', async () => {
    await abrir();
    boton('Eliminar').click();
    fixture.detectChanges();

    boton('Sí, eliminar').click();
    http.expectOne(`${url}/1`).flush({}, { status: 404, statusText: 'Not Found' });
    recargar([suspendida, inactiva]);
    fixture.detectChanges();

    expect(root.textContent).toContain('ya no existe');
    expect(filas()).toEqual(['Arbeláez', 'Pasca']);
  });

  it('con 403 al cargar dice que falta el rol de administrador', async () => {
    fixture = TestBed.createComponent(AdminRoutesComponent);
    fixture.detectChanges();
    http.expectOne(url).flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent)
      .toContain('permiso de administrador');
  });

  it('con un error de red al cargar muestra un mensaje genérico', async () => {
    fixture = TestBed.createComponent(AdminRoutesComponent);
    fixture.detectChanges();
    http.expectOne(url).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No pudimos cargar las rutas');
  });

  it('sin rutas invita a crear la primera', async () => {
    await abrir([]);

    expect(root.textContent).toContain('Crea la primera');
  });

  it('la tabla tiene caption y encabezados de columna para el lector de pantalla', async () => {
    await abrir();

    expect(root.querySelector('caption')?.textContent).toContain('Rutas');
    expect(root.querySelectorAll('thead th[scope="col"]')).toHaveLength(6);
    expect(filaDe('Pasca').querySelector('th[scope="row"]')).not.toBeNull();
  });

  it('los botones de fila tienen nombre accesible con el de la ruta', async () => {
    await abrir();

    const nombres = Array.from(filaDe('Centro - Terminal').querySelectorAll('a, button'))
      .map((e) => e.getAttribute('aria-label'));
    expect(nombres).toEqual(['Editar la ruta Centro - Terminal', 'Eliminar la ruta Centro - Terminal']);
  });
});
