import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminRouteFormComponent } from './admin-route-form.component';
import { ToastService } from '../../../components/toast/toast.service';
import { AdminRouteDetail } from '../../../models/admin-route.model';
import { environment } from '../../../../environments/environment';

describe('AdminRouteFormComponent', () => {
  let http: HttpTestingController;
  let toast: ToastService;
  let router: Router;
  let fixture: ComponentFixture<AdminRouteFormComponent>;
  let root: HTMLElement;

  const url = `${environment.apiUrl}/api/admin/routes`;
  const trazado = '{"type":"LineString","coordinates":[[-74.37,4.34],[-74.36,4.35]]}';

  const urbana: AdminRouteDetail = {
    id: 7, name: 'Centro - Terminal', type: 'URBANA', status: 'ACTIVA', hasPath: true,
    neighborhoodsCount: 2, currentFare: 2600, updatedAt: '2026-11-10T15:00:00-05:00',
    pathGeoJson: { type: 'LineString', coordinates: [[-74.37, 4.34], [-74.36, 4.35]] },
    neighborhoods: ['Centro', 'Terminal'],
    fares: [{ amount: 2600, referencePoint: null, validFrom: '2026-11-01' }],
    signFile: 'ARBELAEZ',
  };

  const intermunicipal: AdminRouteDetail = {
    ...urbana, id: 8, name: 'Fusagasugá - Pasca', type: 'INTERMUNICIPAL', currentFare: 4000,
    fares: [
      { amount: 6000, referencePoint: 'Pasca', validFrom: '2026-11-01' },
      { amount: 4000, referencePoint: 'Arbeláez', validFrom: '2026-11-01' },
    ],
  };

  async function configurar(id: string | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminRouteFormComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id === null ? {} : { id }) } } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  function montar(): void {
    fixture = TestBed.createComponent(AdminRouteFormComponent);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  async function abrirNueva(): Promise<void> {
    await configurar(null);
    montar();
  }

  async function abrirEdicion(detalle: AdminRouteDetail): Promise<void> {
    await configurar(String(detalle.id));
    montar();
    http.expectOne(`${url}/${detalle.id}`).flush(detalle);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  function campo<T extends HTMLElement>(selector: string): T {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`No hay ${selector}`);
    return el;
  }

  function escribir(selector: string, valor: string, evento = 'input'): void {
    const el = campo<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
    el.value = valor;
    el.dispatchEvent(new Event(evento));
    fixture.detectChanges();
  }

  function boton(texto: string): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => (b.textContent ?? '').trim() === texto);
    if (!found) throw new Error(`No hay botón "${texto}"`);
    return found;
  }

  function agregarBarrio(nombre: string): void {
    escribir('#ruta-barrio-nuevo', nombre);
    boton('Agregar barrio').click();
    fixture.detectChanges();
  }

  function barrios(): string[] {
    return Array.from(root.querySelectorAll('.fr-ruta-form__barrio-nombre'))
      .map((e) => (e.textContent ?? '').replace(/^\d+\.\s*/, '').trim());
  }

  function enviar(): void {
    campo<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function errores(): string[] {
    return Array.from(root.querySelectorAll('[role="alert"]')).map((e) => (e.textContent ?? '').trim());
  }

  /** Llena una ruta urbana válida. */
  function llenarUrbana(): void {
    escribir('#ruta-nombre', 'Centro - Terminal');
    agregarBarrio('Centro');
    agregarBarrio('Terminal');
    escribir('#ruta-tarifa-urbana', '2600');
  }

  describe('crear', () => {
    beforeEach(abrirNueva);

    it('arranca vacío, en tipo URBANA y con todas las etiquetas asociadas a su campo', () => {
      expect(root.textContent).toContain('Crear ruta');
      expect(campo<HTMLSelectElement>('#ruta-tipo').value).toBe('URBANA');
      for (const label of Array.from(root.querySelectorAll('label[for]'))) {
        const id = label.getAttribute('for')!;
        expect(root.querySelector(`#${id}`), `campo de la etiqueta ${id}`).not.toBeNull();
      }
    });

    it('sin datos no llama al backend y marca los errores con role="alert"', () => {
      enviar();

      http.expectNone(url);
      const mensajes = errores().join(' | ');
      expect(mensajes).toContain('entre 3 y 140');
      expect(mensajes).toContain('al menos un barrio');
      expect(mensajes).toContain('valor del pasaje');
      expect(campo('#ruta-nombre').getAttribute('aria-invalid')).toBe('true');
    });

    it('urbana: manda una sola tarifa sin referencePoint y omite lo opcional vacío', () => {
      llenarUrbana();
      enviar();

      const req = http.expectOne(url);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Centro - Terminal',
        type: 'URBANA',
        neighborhoods: ['Centro', 'Terminal'],
        fares: [{ amount: 2600 }],
      });
      req.flush({ ...urbana }, { status: 201, statusText: 'Created' });
    });

    it('al guardar con éxito avisa y vuelve a la lista', () => {
      llenarUrbana();
      escribir('#ruta-letrero', ' ARBELAEZ ');
      escribir('#ruta-trazado', trazado);
      enviar();

      const req = http.expectOne(url);
      expect(req.request.body.signFile).toBe('ARBELAEZ');
      expect(req.request.body.pathGeoJson).toEqual({
        type: 'LineString', coordinates: [[-74.37, 4.34], [-74.36, 4.35]],
      });
      req.flush({ ...urbana }, { status: 201, statusText: 'Created' });

      expect(toast.current()?.message).toContain('creada');
      expect(router.navigate).toHaveBeenCalledWith(['/admin/rutas']);
    });

    it('el botón queda deshabilitado mientras envía y no envía dos veces', () => {
      llenarUrbana();
      enviar();
      const enviarBtn = campo<HTMLButtonElement>('button[type="submit"]');

      expect(enviarBtn.disabled).toBe(true);
      expect(enviarBtn.textContent).toContain('Guardando');
      enviar();
      http.expectOne(url).flush({ ...urbana }, { status: 201, statusText: 'Created' });
    });

    it('intermunicipal: pide una fila punto + precio, la manda ordenada por monto', () => {
      escribir('#ruta-nombre', 'Fusagasugá - Pasca');
      agregarBarrio('Centro');
      escribir('#ruta-tipo', 'INTERMUNICIPAL', 'change');

      expect(root.querySelector('#ruta-tarifa-urbana')).toBeNull();
      expect(root.querySelectorAll('[id^="tarifa-punto-"]')).toHaveLength(1);

      boton('Agregar tarifa').click();
      fixture.detectChanges();
      const puntos = Array.from(root.querySelectorAll<HTMLInputElement>('[id^="tarifa-punto-"]'));
      const valores = Array.from(root.querySelectorAll<HTMLInputElement>('[id^="tarifa-valor-"]'));
      puntos[0].value = 'Pasca'; puntos[0].dispatchEvent(new Event('input'));
      valores[0].value = '6000'; valores[0].dispatchEvent(new Event('input'));
      puntos[1].value = 'Arbeláez'; puntos[1].dispatchEvent(new Event('input'));
      valores[1].value = '4000'; valores[1].dispatchEvent(new Event('input'));
      fixture.detectChanges();
      enviar();

      const req = http.expectOne(url);
      expect(req.request.body.type).toBe('INTERMUNICIPAL');
      expect(req.request.body.fares).toEqual([
        { amount: 4000, referencePoint: 'Arbeláez' },
        { amount: 6000, referencePoint: 'Pasca' },
      ]);
      req.flush({ ...intermunicipal }, { status: 201, statusText: 'Created' });
    });

    it('intermunicipal: rechaza puntos de referencia repetidos antes de enviar', () => {
      escribir('#ruta-nombre', 'Fusagasugá - Pasca');
      agregarBarrio('Centro');
      escribir('#ruta-tipo', 'INTERMUNICIPAL', 'change');
      boton('Agregar tarifa').click();
      fixture.detectChanges();
      const puntos = Array.from(root.querySelectorAll<HTMLInputElement>('[id^="tarifa-punto-"]'));
      const valores = Array.from(root.querySelectorAll<HTMLInputElement>('[id^="tarifa-valor-"]'));
      for (const [i, el] of puntos.entries()) { el.value = 'Pasca'; el.dispatchEvent(new Event('input')); valores[i].value = '5000'; valores[i].dispatchEvent(new Event('input')); }
      fixture.detectChanges();
      enviar();

      http.expectNone(url);
      expect(errores().join(' ')).toContain('repetido');
    });

    it('al salir del campo de monto, las filas se reordenan de menor a mayor', () => {
      escribir('#ruta-tipo', 'INTERMUNICIPAL', 'change');
      boton('Agregar tarifa').click();
      fixture.detectChanges();
      const puntos = Array.from(root.querySelectorAll<HTMLInputElement>('[id^="tarifa-punto-"]'));
      const valores = Array.from(root.querySelectorAll<HTMLInputElement>('[id^="tarifa-valor-"]'));
      puntos[0].value = 'Pasca'; puntos[0].dispatchEvent(new Event('input'));
      valores[0].value = '9000'; valores[0].dispatchEvent(new Event('input'));
      puntos[1].value = 'Arbeláez'; puntos[1].dispatchEvent(new Event('input'));
      valores[1].value = '4000'; valores[1].dispatchEvent(new Event('input'));
      valores[1].dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      const orden = Array.from(root.querySelectorAll<HTMLInputElement>('[id^="tarifa-punto-"]')).map((e) => e.value);
      expect(orden).toEqual(['Arbeláez', 'Pasca']);
    });

    describe('barrios', () => {
      it('agrega, no repite y muestra el aviso al instante', () => {
        agregarBarrio('Centro');
        agregarBarrio('  centro ');

        expect(barrios()).toEqual(['Centro']);
        expect(errores().join(' ')).toContain('ya está en la lista');
      });

      it('sube, baja y quita con botones que nombran al barrio', () => {
        agregarBarrio('A'); agregarBarrio('B'); agregarBarrio('C');

        campo<HTMLButtonElement>('button[aria-label="Subir C"]').click();
        fixture.detectChanges();
        expect(barrios()).toEqual(['A', 'C', 'B']);

        campo<HTMLButtonElement>('button[aria-label="Bajar A"]').click();
        fixture.detectChanges();
        expect(barrios()).toEqual(['C', 'A', 'B']);

        campo<HTMLButtonElement>('button[aria-label="Quitar A"]').click();
        fixture.detectChanges();
        expect(barrios()).toEqual(['C', 'B']);
      });

      it('el primero no sube y el último no baja', () => {
        agregarBarrio('A'); agregarBarrio('B');

        expect(campo<HTMLButtonElement>('button[aria-label="Subir A"]').disabled).toBe(true);
        expect(campo<HTMLButtonElement>('button[aria-label="Bajar B"]').disabled).toBe(true);
      });

      it('Enter en el campo agrega el barrio sin enviar el formulario', () => {
        escribir('#ruta-barrio-nuevo', 'Centro');
        const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        campo('#ruta-barrio-nuevo').dispatchEvent(enter);
        fixture.detectChanges();

        expect(enter.defaultPrevented).toBe(true);
        expect(barrios()).toEqual(['Centro']);
        http.expectNone(url);
      });

      it('acepta hasta 40 barrios y no el 41', () => {
        for (let i = 1; i <= 41; i++) agregarBarrio(`Barrio ${i}`);

        expect(barrios()).toHaveLength(40);
        expect(root.textContent).toContain('hasta 40');
      });
    });

    describe('trazado', () => {
      it('valida al instante, sin esperar al envío', () => {
        escribir('#ruta-trazado', '{"type":');

        expect(errores().join(' ')).toContain('no es un JSON válido');
        expect(campo('#ruta-trazado').getAttribute('aria-invalid')).toBe('true');
      });

      it('rechaza un LineString con una sola posición', () => {
        escribir('#ruta-trazado', '{"type":"LineString","coordinates":[[-74.37,4.34]]}');

        expect(errores().join(' ')).toContain('2 posiciones');
      });

      it('con un trazado válido muestra la vista previa en el mapa y ningún error', () => {
        escribir('#ruta-trazado', trazado);

        expect(errores()).toEqual([]);
        expect(root.querySelector('app-map-view')).not.toBeNull();
      });

      it('con un trazado inválido no hay vista previa, y con texto vacío tampoco', () => {
        escribir('#ruta-trazado', '[1,2]');
        expect(root.querySelector('app-map-view')).toBeNull();
        escribir('#ruta-trazado', '');
        expect(root.querySelector('app-map-view')).toBeNull();
        expect(errores()).toEqual([]);
      });

      it('un trazado inválido impide enviar', () => {
        llenarUrbana();
        escribir('#ruta-trazado', 'no es json');
        enviar();

        http.expectNone(url);
      });
    });

    describe('errores del servidor', () => {
      it('un 409 va en el campo nombre', () => {
        llenarUrbana();
        enviar();
        http.expectOne(url).flush({ status: 409, detail: 'Nombre repetido' }, { status: 409, statusText: 'Conflict' });
        fixture.detectChanges();

        const error = root.querySelector('#ruta-nombre-error');
        expect(error?.textContent).toContain('Ya existe una ruta con ese nombre');
        expect(error?.getAttribute('role')).toBe('alert');
        expect(campo('#ruta-nombre').getAttribute('aria-describedby')).toBe('ruta-nombre-error');
        expect(campo<HTMLButtonElement>('button[type="submit"]').disabled).toBe(false);
        expect(router.navigate).not.toHaveBeenCalled();
      });

      it('al corregir el nombre se limpia el error del 409', () => {
        llenarUrbana();
        enviar();
        http.expectOne(url).flush({}, { status: 409, statusText: 'Conflict' });
        fixture.detectChanges();

        escribir('#ruta-nombre', 'Otro nombre distinto');

        expect(root.querySelector('#ruta-nombre-error')).toBeNull();
      });

      it('un 400 pinta cada error junto a su campo, incluidos los de la forma fares[0].amount', () => {
        llenarUrbana();
        enviar();
        http.expectOne(url).flush({
          status: 400, detail: 'Datos inválidos',
          errors: [
            { field: 'name', message: 'El nombre ya es muy corto para el servidor' },
            { field: 'fares[0].amount', message: 'La tarifa debe ser mayor que 0' },
            { field: 'pathGeoJson', message: 'Trazado no válido para el servidor' },
          ],
        }, { status: 400, statusText: 'Bad Request' });
        fixture.detectChanges();

        const mensajes = errores().join(' | ');
        expect(mensajes).toContain('muy corto para el servidor');
        expect(mensajes).toContain('La tarifa debe ser mayor que 0');
        expect(mensajes).toContain('Trazado no válido para el servidor');
        expect(root.querySelector('#ruta-nombre-error')?.textContent).toContain('muy corto');
      });

      it('un 400 con un campo desconocido lo lista aparte en vez de perderlo', () => {
        llenarUrbana();
        enviar();
        http.expectOne(url).flush({
          status: 400, detail: 'Datos inválidos',
          errors: [{ field: 'campoRaro', message: 'algo falló' }],
        }, { status: 400, statusText: 'Bad Request' });
        fixture.detectChanges();

        expect(errores().join(' ')).toContain('campoRaro: algo falló');
      });

      it('un 403 dice que falta el rol de administrador', () => {
        llenarUrbana();
        enviar();
        http.expectOne(url).flush({}, { status: 403, statusText: 'Forbidden' });
        fixture.detectChanges();

        expect(errores().join(' ')).toContain('permiso de administrador');
      });

      it('un error 500 con detail lo muestra y deja reintentar', () => {
        llenarUrbana();
        enviar();
        http.expectOne(url).flush({ status: 500, detail: 'Fallo interno' }, { status: 500, statusText: 'Server Error' });
        fixture.detectChanges();

        expect(errores().join(' ')).toContain('Fallo interno');
        expect(campo<HTMLButtonElement>('button[type="submit"]').disabled).toBe(false);
      });
    });
  });

  describe('editar', () => {
    it('carga el detalle y lo pone en el formulario, con la señal y el trazado', async () => {
      await abrirEdicion(urbana);

      expect(root.textContent).toContain('Editar ruta');
      expect(campo<HTMLInputElement>('#ruta-nombre').value).toBe('Centro - Terminal');
      expect(campo<HTMLSelectElement>('#ruta-tipo').value).toBe('URBANA');
      expect(campo<HTMLInputElement>('#ruta-tarifa-urbana').value).toBe('2600');
      expect(campo<HTMLInputElement>('#ruta-letrero').value).toBe('ARBELAEZ');
      expect(JSON.parse(campo<HTMLTextAreaElement>('#ruta-trazado').value)).toEqual(urbana.pathGeoJson);
      expect(barrios()).toEqual(['Centro', 'Terminal']);
      expect(root.querySelector('app-map-view')).not.toBeNull();
    });

    it('intermunicipal: las tarifas llegan ordenadas por monto', async () => {
      await abrirEdicion(intermunicipal);

      const puntos = Array.from(root.querySelectorAll<HTMLInputElement>('[id^="tarifa-punto-"]')).map((e) => e.value);
      expect(puntos).toEqual(['Arbeláez', 'Pasca']);
    });

    it('guarda con PUT a /api/admin/routes/{id}', async () => {
      await abrirEdicion(urbana);

      escribir('#ruta-tarifa-urbana', '2800');
      enviar();

      const req = http.expectOne(`${url}/7`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.fares).toEqual([{ amount: 2800 }]);
      req.flush({ ...urbana, currentFare: 2800 });

      expect(toast.current()?.message).toContain('guardados');
      expect(router.navigate).toHaveBeenCalledWith(['/admin/rutas']);
    });

    it('mover un barrio y guardar manda el nuevo orden', async () => {
      await abrirEdicion(urbana);

      campo<HTMLButtonElement>('button[aria-label="Subir Terminal"]').click();
      fixture.detectChanges();
      enviar();

      const req = http.expectOne(`${url}/7`);
      expect(req.request.body.neighborhoods).toEqual(['Terminal', 'Centro']);
      req.flush(urbana);
    });

    it('un 409 al guardar va en el campo nombre', async () => {
      await abrirEdicion(urbana);

      enviar();
      http.expectOne(`${url}/7`).flush({}, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(root.querySelector('#ruta-nombre-error')?.textContent).toContain('Ya existe una ruta con ese nombre');
    });

    it('un 404 al cargar dice que la ruta ya no existe y no muestra el formulario', async () => {
      await configurar('99');
      montar();
      http.expectOne(`${url}/99`).flush({}, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      expect(root.textContent).toContain('ya no existe');
      expect(root.querySelector('form')).toBeNull();
    });

    it('un id que no es un número positivo no llama al backend', async () => {
      await configurar('abc');
      montar();

      expect(root.textContent).toContain('no existe');
      http.expectNone(`${url}/abc`);
    });

    it('al borrar el trazado y guardar, no manda pathGeoJson', async () => {
      await abrirEdicion(urbana);

      escribir('#ruta-trazado', '');
      enviar();

      const req = http.expectOne(`${url}/7`);
      expect('pathGeoJson' in req.request.body).toBe(false);
      req.flush(urbana);
    });
  });
});
