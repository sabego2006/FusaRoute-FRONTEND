import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdminCommentsComponent } from './admin-comments.component';
import { ToastService } from '../../../components/toast/toast.service';
import { Comment } from '../../../models/comment.model';
import { environment } from '../../../../environments/environment';

describe('AdminCommentsComponent', () => {
  let http: HttpTestingController;
  let toast: ToastService;

  const adminUrl = `${environment.apiUrl}/api/admin/comments`;

  const pendiente: Comment = {
    id: 5,
    authorName: 'Ana',
    text: 'La ruta deberia pasar mas seguido',
    status: 'PENDING',
    reply: null,
    answeredAt: null,
    createdAt: '2026-11-07T10:00:00Z',
    updatedAt: '2026-11-07T10:00:00Z',
    editable: true,
  };

  const respondido: Comment = {
    id: 6,
    authorName: 'Beto',
    text: 'La ruta no pasa por mi barrio',
    status: 'ANSWERED',
    reply: 'Lo revisamos manana',
    answeredAt: '2026-11-07T12:00:00Z',
    createdAt: '2026-11-06T10:00:00Z',
    updatedAt: '2026-11-07T12:00:00Z',
    editable: false,
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminCommentsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => http.verify());

  /** Monta el panel y resuelve la carga inicial, que va sin filtro. */
  function montar(lista: Comment[] = []): ComponentFixture<AdminCommentsComponent> {
    const fixture = TestBed.createComponent(AdminCommentsComponent);
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === adminUrl);
    expect(req.request.params.keys()).toEqual([]);
    req.flush(lista);
    fixture.detectChanges();
    return fixture;
  }

  function texto(fixture: ComponentFixture<AdminCommentsComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function boton(fixture: ComponentFixture<AdminCommentsComponent>, etiqueta: string): HTMLButtonElement | undefined {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((b) => (b.textContent ?? '').trim() === etiqueta) as HTMLButtonElement | undefined;
  }

  // --- SCRUM-98: listado ----------------------------------------------------

  /**
   * El orden lo decide el backend, así que lo que se comprueba es que la pantalla
   * respete el orden en que llega la lista en vez de reordenarla por su cuenta.
   */
  it('respeta el orden en que llegan los comentarios, con los pendientes primero', () => {
    const fixture = montar([pendiente, respondido]);

    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Pendiente');
    expect(items[1].textContent).toContain('Respondido');
  });

  it('muestra el nombre del autor de cada comentario', () => {
    const fixture = montar([pendiente, respondido]);

    expect(texto(fixture)).toContain('Ana');
    expect(texto(fixture)).toContain('Beto');
  });

  it('cuenta cuántos quedan pendientes', () => {
    const fixture = montar([pendiente, respondido]);

    expect(texto(fixture)).toContain('1 pendiente(s) de 2 en pantalla');
  });

  it('la respuesta ya dada es visible en el comentario respondido', () => {
    const fixture = montar([respondido]);

    expect(texto(fixture)).toContain('Tu respuesta');
    expect(texto(fixture)).toContain('Lo revisamos manana');
  });

  it('filtrar por pendientes pide el listado con ese estado', () => {
    const fixture = montar([pendiente, respondido]);

    boton(fixture, 'Pendientes')?.click();
    const req = http.expectOne((r) => r.url === adminUrl && r.params.get('status') === 'PENDING');
    req.flush([pendiente]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('li').length).toBe(1);
  });

  it('filtrar por respondidos pide el listado con ese estado', () => {
    const fixture = montar([pendiente, respondido]);

    boton(fixture, 'Respondidos')?.click();
    http.expectOne((r) => r.url === adminUrl && r.params.get('status') === 'ANSWERED').flush([respondido]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('li').length).toBe(1);
  });

  it('volver a pulsar el filtro activo no repite la petición', () => {
    const fixture = montar([pendiente]);

    // Ya está en "Todos" desde el montaje; pulsarlo otra vez no debe pedir nada.
    boton(fixture, 'Todos')?.click();
    fixture.detectChanges();
    // http.verify() del afterEach falla si hubiera una petición sin atender.
  });

  it('el mensaje de lista vacía depende del filtro', () => {
    const fixture = montar([]);
    expect(texto(fixture)).toContain('Nadie ha dejado comentarios todavía.');

    boton(fixture, 'Pendientes')?.click();
    http.expectOne((r) => r.url === adminUrl && r.params.get('status') === 'PENDING').flush([]);
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No hay comentarios pendientes. Todo respondido.');
  });

  // --- SCRUM-99 y SCRUM-100: responder y corregir ---------------------------

  it('responder un pendiente manda PUT con la respuesta y actualiza la tarjeta', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Responder')?.click();
    fixture.detectChanges();

    const area = (fixture.nativeElement as HTMLElement)
      .querySelector('#respuesta-5') as HTMLTextAreaElement;
    // Un pendiente arranca con el campo vacío: no hay respuesta anterior.
    expect(area.value).toBe('');
    area.value = 'Ya agregamos el barrio al recorrido';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    boton(fixture, 'Guardar respuesta')?.click();
    const req = http.expectOne(`${adminUrl}/5/reply`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ reply: 'Ya agregamos el barrio al recorrido' });
    req.flush({
      ...pendiente,
      status: 'ANSWERED',
      reply: 'Ya agregamos el barrio al recorrido',
      answeredAt: '2026-11-07T15:00:00Z',
      editable: false,
    });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Respondido');
    expect(texto(fixture)).toContain('Ya agregamos el barrio al recorrido');
  });

  it('al responder muestra un toast de confirmación', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Responder')?.click();
    fixture.detectChanges();
    const area = (fixture.nativeElement as HTMLElement)
      .querySelector('#respuesta-5') as HTMLTextAreaElement;
    area.value = 'Ya lo revisamos';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton(fixture, 'Guardar respuesta')?.click();
    http.expectOne(`${adminUrl}/5/reply`).flush({ ...pendiente, status: 'ANSWERED', reply: 'Ya lo revisamos', editable: false });

    expect(toast.current()?.message).toBe('Comentario respondido');
  });

  /**
   * SCRUM-100: corregir es editar, no crear una segunda respuesta. El botón lo dice y
   * el campo arranca con lo que había, que es la diferencia visible entre responder y
   * corregir.
   */
  it('un comentario ya respondido ofrece editar la respuesta, con el texto anterior cargado', () => {
    const fixture = montar([respondido]);

    expect(boton(fixture, 'Editar respuesta')).toBeDefined();
    expect(boton(fixture, 'Responder')).toBeUndefined();

    boton(fixture, 'Editar respuesta')?.click();
    fixture.detectChanges();

    const area = (fixture.nativeElement as HTMLElement)
      .querySelector('#respuesta-6') as HTMLTextAreaElement;
    expect(area.value).toBe('Lo revisamos manana');
  });

  it('corregir la respuesta manda el PUT y deja UNA sola respuesta', () => {
    const fixture = montar([respondido]);

    boton(fixture, 'Editar respuesta')?.click();
    fixture.detectChanges();
    const area = (fixture.nativeElement as HTMLElement)
      .querySelector('#respuesta-6') as HTMLTextAreaElement;
    area.value = 'Ya quedo agregado el barrio';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    boton(fixture, 'Guardar respuesta')?.click();
    http.expectOne(`${adminUrl}/6/reply`).flush({ ...respondido, reply: 'Ya quedo agregado el barrio' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Ya quedo agregado el barrio');
    expect(texto(fixture)).not.toContain('Lo revisamos manana');
    expect(toast.current()?.message).toBe('Respuesta actualizada');
  });

  it('no deja guardar una respuesta vacía', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Responder')?.click();
    fixture.detectChanges();

    expect(boton(fixture, 'Guardar respuesta')?.disabled).toBe(true);

    const area = (fixture.nativeElement as HTMLElement)
      .querySelector('#respuesta-5') as HTMLTextAreaElement;
    area.value = '   ';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(boton(fixture, 'Guardar respuesta')?.disabled).toBe(true);
  });

  it('cancelar deja el comentario como estaba', () => {
    const fixture = montar([respondido]);

    boton(fixture, 'Editar respuesta')?.click();
    fixture.detectChanges();
    boton(fixture, 'Cancelar')?.click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#respuesta-6')).toBeNull();
    expect(texto(fixture)).toContain('Lo revisamos manana');
  });

  /**
   * Con el filtro en "Pendientes", el comentario que se acaba de responder ya no
   * pertenece a la lista: dejarlo ahí contradiría al filtro que el administrador puso.
   */
  it('con el filtro en pendientes, el comentario respondido sale de la lista', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Pendientes')?.click();
    http.expectOne((r) => r.url === adminUrl && r.params.get('status') === 'PENDING').flush([pendiente]);
    fixture.detectChanges();

    boton(fixture, 'Responder')?.click();
    fixture.detectChanges();
    const area = (fixture.nativeElement as HTMLElement)
      .querySelector('#respuesta-5') as HTMLTextAreaElement;
    area.value = 'Ya lo revisamos';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton(fixture, 'Guardar respuesta')?.click();
    http.expectOne(`${adminUrl}/5/reply`).flush({ ...pendiente, status: 'ANSWERED', reply: 'Ya lo revisamos', editable: false });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No hay comentarios pendientes. Todo respondido.');
  });

  // --- Errores --------------------------------------------------------------

  it('un 400 al responder muestra el mensaje del backend', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Responder')?.click();
    fixture.detectChanges();
    const area = (fixture.nativeElement as HTMLElement)
      .querySelector('#respuesta-5') as HTMLTextAreaElement;
    area.value = 'x'.repeat(10);
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton(fixture, 'Guardar respuesta')?.click();

    http.expectOne(`${adminUrl}/5/reply`).flush(
      { status: 400, detail: 'La respuesta no puede pasar de 500 caracteres' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(texto(fixture)).toContain('La respuesta no puede pasar de 500 caracteres');
  });

  it('un 404 al responder recarga la lista, porque lo que se ve ya no corresponde', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Responder')?.click();
    fixture.detectChanges();
    const area = (fixture.nativeElement as HTMLElement)
      .querySelector('#respuesta-5') as HTMLTextAreaElement;
    area.value = 'Ya lo revisamos';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton(fixture, 'Guardar respuesta')?.click();

    http.expectOne(`${adminUrl}/5/reply`).flush(
      { status: 404, detail: 'El comentario no existe' },
      { status: 404, statusText: 'Not Found' },
    );
    http.expectOne((r) => r.url === adminUrl).flush([]);
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Nadie ha dejado comentarios todavía.');
  });

  /**
   * El 403 es el caso de alguien que forzó la ruta sin rol, o de un administrador
   * recién nombrado cuyo token todavía dice USER. Merece su propio mensaje porque la
   * acción que lo resuelve —volver a iniciar sesión— no es obvia.
   */
  it('un 403 al cargar explica que falta el rol y que hay que reloguear', () => {
    const fixture = TestBed.createComponent(AdminCommentsComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === adminUrl).flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No tienes permiso de administrador.');
    expect(texto(fixture)).toContain('cierra sesión y vuelve a entrar');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('li').length).toBe(0);
  });

  /**
   * Del 401 se encarga `authInterceptor` (cierra la sesión y lleva al login, probado
   * en su propio spec). Aquí solo se comprueba que el panel no pinte un error encima
   * mientras ocurre esa redirección.
   */
  it('un 401 al cargar no pinta ningún error: la redirección al login es del interceptor', () => {
    const fixture = TestBed.createComponent(AdminCommentsComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === adminUrl).flush(null, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.fr-alerta')).toBeNull();
    expect(texto(fixture)).not.toContain('No pudimos cargar');
  });

  /** Abre el formulario del comentario pendiente, escribe y pulsa guardar. */
  function responder(fixture: ComponentFixture<AdminCommentsComponent>): void {
    boton(fixture, 'Responder')!.click();
    fixture.detectChanges();
    const area = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
    area.value = 'Gracias por avisar';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton(fixture, 'Guardar respuesta')!.click();
  }

  /** El rol pudo perderse entre la carga y la respuesta (token de una cuenta degradada). */
  it('un 403 al responder dice que falta el permiso, no el detalle genérico del backend', () => {
    const fixture = montar([pendiente]);
    responder(fixture);
    http.expectOne(`${adminUrl}/${pendiente.id}/reply`)
      .flush({ detail: 'Access Denied' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No tienes permiso de administrador.');
    expect(texto(fixture)).not.toContain('Access Denied');
  });

  it('un 401 al responder no pinta error en la fila', () => {
    const fixture = montar([pendiente]);
    responder(fixture);
    http.expectOne(`${adminUrl}/${pendiente.id}/reply`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.fr-ayuda-error')).toBeNull();
  });

  it('otro error al cargar muestra un mensaje genérico', () => {
    const fixture = TestBed.createComponent(AdminCommentsComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === adminUrl).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar los comentarios.');
  });
});
