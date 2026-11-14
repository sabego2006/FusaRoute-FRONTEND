import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminSuspensionsComponent } from './admin-suspensions.component';
import { ToastService } from '../../../components/toast/toast.service';
import { Suspension } from '../../../models/suspension.model';
import { AdminRouteSummary } from '../../../models/admin-route.model';
import { environment } from '../../../../environments/environment';

const api = environment.apiUrl;
const route = (id: number, name: string, status: AdminRouteSummary['status'] = 'ACTIVA'): AdminRouteSummary => ({
  id, name, type: 'URBANA', status, hasPath: true, neighborhoodsCount: 3, currentFare: 2600, updatedAt: '2026-11-10T15:00:00Z',
});
const vigente: Suspension = {
  id: 7, routeId: 1, routeName: 'Centro - Terminal', startsAt: '2026-11-20T13:00:00Z',
  endsAt: '2026-11-23T01:00:00Z', reason: 'Obras', liftedAt: null, state: 'ACTIVE',
};
const pasada: Suspension = { ...vigente, id: 8, routeName: 'Arbeláez', reason: null, state: 'ENDED' };

describe('AdminSuspensionsComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AdminSuspensionsComponent>;
  let root: HTMLElement;
  let toast: ToastService;

  const settle = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };
  const q = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const set = async (sel: string, value: string, ev = 'input') => {
    const el = q<HTMLInputElement>(sel);
    el.value = value;
    el.dispatchEvent(new Event(ev));
    await settle();
  };

  async function abrir(list: Suspension[] = [vigente]) {
    fixture = TestBed.createComponent(AdminSuspensionsComponent);
    fixture.detectChanges();
    http.expectOne(`${api}/api/admin/suspensions?state=active`).flush(list);
    http.expectOne(`${api}/api/admin/routes`).flush([route(1, 'Centro - Terminal'), route(2, 'Pasca', 'INACTIVA')]);
    await settle();
    root = fixture.nativeElement as HTMLElement;
  }

  async function llenar(inicio = '2026-11-20T08:00', fin = '2026-11-22T20:00') {
    await set('#susp-ruta', '1', 'change');
    await set('#susp-inicio', inicio);
    await set('#susp-fin', fin);
  }
  const enviar = async () => { q<HTMLFormElement>('form').dispatchEvent(new Event('submit')); await settle(); };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminSuspensionsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
  });
  afterEach(() => http.verify());

  it('lista la ventana en hora de Colombia, el motivo y el estado en texto', async () => {
    await abrir();
    const text = root.textContent ?? '';
    expect(text).toContain('Centro - Terminal');
    expect(text).toContain('20 de noviembre de 2026 a las 08:00');
    expect(text).toContain('22 de noviembre de 2026 a las 20:00');
    expect(text).toContain('Obras');
    expect(text).toContain('Vigente');
  });

  it('el selector solo ofrece rutas activas', async () => {
    await abrir();
    const options = Array.from(root.querySelectorAll('#susp-ruta option')).map((o) => o.textContent?.trim());
    expect(options).toContain('Centro - Terminal');
    expect(options).not.toContain('Pasca');
  });

  it('cada filtro pide su estado y las pasadas no tienen Reactivar', async () => {
    await abrir();
    const botones = Array.from(root.querySelectorAll('.fr-susp__filtros button')) as HTMLButtonElement[];
    expect(botones.map((b) => b.textContent?.trim())).toEqual(['Vigentes', 'Próximas', 'Pasadas', 'Todas']);
    botones[2].click();
    http.expectOne(`${api}/api/admin/suspensions?state=past`).flush([pasada]);
    await settle();
    expect(root.textContent).toContain('Terminada');
    expect(root.textContent).not.toContain('Reactivar la ruta');
  });

  it('Reactivar pide confirmación y luego hace DELETE', async () => {
    await abrir();
    (root.querySelector('button[aria-label="Reactivar la ruta Centro - Terminal"]') as HTMLButtonElement).click();
    await settle();
    expect(q('[role="alertdialog"]')).not.toBeNull();
    http.expectNone(`${api}/api/admin/suspensions/7`);
    const si = Array.from(root.querySelectorAll('[role="alertdialog"] button')).find((b) => b.textContent?.includes('Sí, reactivar')) as HTMLButtonElement;
    si.click();
    http.expectOne(`${api}/api/admin/suspensions/7`).flush({ ...vigente, state: 'LIFTED' });
    http.expectOne(`${api}/api/admin/suspensions?state=active`).flush([]);
    await settle();
    expect(toast.current()?.message).toContain('reactivada');
    expect(q('[role="alertdialog"]')).toBeNull();
  });

  it('cancelar la confirmación no llama al backend', async () => {
    await abrir();
    (root.querySelector('button[aria-label^="Reactivar"]') as HTMLButtonElement).click();
    await settle();
    (Array.from(root.querySelectorAll('[role="alertdialog"] button')).find((b) => b.textContent?.includes('Cancelar')) as HTMLButtonElement).click();
    await settle();
    expect(q('[role="alertdialog"]')).toBeNull();
  });

  it('crea la suspensión enviando las horas de Colombia con offset -05:00', async () => {
    await abrir();
    await llenar();
    await set('#susp-motivo', 'Obras en la Cra. 6');
    expect(root.textContent).toContain('18/200');
    await enviar();
    const req = http.expectOne(`${api}/api/admin/routes/1/suspensions`);
    expect(req.request.body).toEqual({
      startsAt: '2026-11-20T08:00:00-05:00', endsAt: '2026-11-22T20:00:00-05:00', reason: 'Obras en la Cra. 6',
    });
    req.flush(vigente, { status: 201, statusText: 'Created' });
    http.expectOne(`${api}/api/admin/suspensions?state=active`).flush([vigente]);
    await settle();
    expect(toast.current()?.message).toContain('suspendida');
  });

  it('valida en el cliente sin llamar al backend', async () => {
    await abrir();
    await enviar();
    expect(root.querySelectorAll('[role="alert"]').length).toBeGreaterThanOrEqual(3);
    await llenar('2026-11-22T20:00', '2026-11-20T08:00');
    await enviar();
    expect(root.textContent).toContain('El fin debe ser posterior al inicio');
    http.expectNone(`${api}/api/admin/routes/1/suspensions`);
  });

  it('muestra el 400 por campo junto a su campo', async () => {
    await abrir();
    await llenar();
    await enviar();
    http.expectOne(`${api}/api/admin/routes/1/suspensions`).flush(
      { status: 400, detail: 'x', errors: [{ field: 'endsAt', message: 'La duración máxima es 90 días.' }] },
      { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(q('#susp-fin-error').textContent).toContain('90 días');
    expect(q('#susp-fin').getAttribute('aria-invalid')).toBe('true');
  });

  it('el 409 por solape dice que se solapa', async () => {
    await abrir();
    await llenar();
    await enviar();
    http.expectOne(`${api}/api/admin/routes/1/suspensions`).flush(
      { status: 409, detail: 'La ventana se solapa con otra suspensión.' }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(q('.fr-alerta').textContent).toContain('Ya existe una suspensión que se solapa');
  });

  it('el 409 por ruta inactiva dice que la ruta está eliminada', async () => {
    await abrir();
    await llenar();
    await enviar();
    http.expectOne(`${api}/api/admin/routes/1/suspensions`).flush(
      { status: 409, detail: 'La ruta está INACTIVA.' }, { status: 409, statusText: 'Conflict' });
    http.expectOne(`${api}/api/admin/routes`).flush([route(1, 'Centro - Terminal', 'INACTIVA')]);
    await settle();
    expect(q('.fr-alerta').textContent).toContain('La ruta está eliminada');
  });

  it('el 409 al reactivar avisa que ya terminó y recarga', async () => {
    await abrir();
    (root.querySelector('button[aria-label^="Reactivar"]') as HTMLButtonElement).click();
    await settle();
    (Array.from(root.querySelectorAll('[role="alertdialog"] button')).find((b) => b.textContent?.includes('Sí, reactivar')) as HTMLButtonElement).click();
    http.expectOne(`${api}/api/admin/suspensions/7`).flush({}, { status: 409, statusText: 'Conflict' });
    http.expectOne(`${api}/api/admin/suspensions?state=active`).flush([]);
    await settle();
    expect(q('.fr-alerta').textContent).toContain('ya terminó o ya estaba reactivada');
  });

  it('el motivo muestra su contador', async () => {
    await abrir();
    expect(root.textContent).toContain('0/200');
  });
});
