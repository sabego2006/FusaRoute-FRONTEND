import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CommentsComponent } from './comments.component';
import { ToastService } from '../../components/toast/toast.service';
import { Comment } from '../../models/comment.model';
import { environment } from '../../../environments/environment';

describe('CommentsComponent', () => {
  let http: HttpTestingController;
  let toast: ToastService;

  const base = `${environment.apiUrl}/api/comments`;

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
    authorName: 'Ana',
    text: 'La ruta no pasa por mi barrio',
    status: 'ANSWERED',
    reply: 'Ya agregamos el barrio al recorrido',
    answeredAt: '2026-11-07T12:00:00Z',
    createdAt: '2026-11-06T10:00:00Z',
    updatedAt: '2026-11-07T12:00:00Z',
    editable: false,
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CommentsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => http.verify());

  /** Monta la pantalla y resuelve la carga inicial de "mis comentarios". */
  function montar(lista: Comment[] = []): ComponentFixture<CommentsComponent> {
    const fixture = TestBed.createComponent(CommentsComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/me`).flush(lista);
    fixture.detectChanges();
    return fixture;
  }

  function texto(fixture: ComponentFixture<CommentsComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function escribir(fixture: ComponentFixture<CommentsComponent>, valor: string): void {
    const area = (fixture.nativeElement as HTMLElement).querySelector('#text') as HTMLTextAreaElement;
    area.value = valor;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function botonEnviar(fixture: ComponentFixture<CommentsComponent>): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement)
      .querySelector('button[type="submit"]') as HTMLButtonElement;
  }

  /** Busca un botón por su texto visible, que es como lo encuentra el usuario. */
  function boton(fixture: ComponentFixture<CommentsComponent>, etiqueta: string): HTMLButtonElement | undefined {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((b) => (b.textContent ?? '').trim() === etiqueta) as HTMLButtonElement | undefined;
  }

  // --- Contador de caracteres (SCRUM-96) ------------------------------------

  it('muestra el contador de 10 a 100 caracteres', () => {
    const fixture = montar();

    expect(texto(fixture)).toContain('0/100 caracteres');

    escribir(fixture, 'corto');
    expect(texto(fixture)).toContain('5/100 caracteres');
    expect(texto(fixture)).toContain('faltan 5 para el mínimo');
  });

  it('el botón de enviar está deshabilitado mientras el texto no llegue al mínimo', () => {
    const fixture = montar();

    expect(botonEnviar(fixture).disabled).toBe(true);

    escribir(fixture, 'nueve car');
    expect(botonEnviar(fixture).disabled).toBe(true);

    escribir(fixture, 'diez carac');
    expect(botonEnviar(fixture).disabled).toBe(false);
  });

  /**
   * El contador mide el texto YA RECORTADO, que es lo que cuenta el backend. Si midiera
   * en bruto, un comentario de 8 letras entre espacios parecería válido y el servidor
   * lo rechazaría igual.
   */
  it('el contador no cuenta los espacios de los extremos', () => {
    const fixture = montar();

    escribir(fixture, '   ocho car   ');
    expect(texto(fixture)).toContain('8/100 caracteres');
    expect(botonEnviar(fixture).disabled).toBe(true);
  });

  it('el campo no deja escribir más de 100 caracteres', () => {
    const fixture = montar();
    const area = (fixture.nativeElement as HTMLElement).querySelector('#text') as HTMLTextAreaElement;

    expect(area.getAttribute('maxlength')).toBe('100');
  });

  // --- Enviar (SCRUM-92 / SCRUM-93) -----------------------------------------

  it('enviar un comentario lo agrega de primero en la lista', () => {
    const fixture = montar([respondido]);

    escribir(fixture, 'La ruta deberia pasar mas seguido');
    botonEnviar(fixture).click();

    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    req.flush(pendiente, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('La ruta deberia pasar mas seguido');
  });

  /**
   * SCRUM-93: la confirmación es un toast transitorio. El `ToastService` ya se cierra
   * solo a los 4 s y no tiene botón, así que lo que hay que comprobar aquí es que se
   * use y con qué mensaje.
   */
  it('al enviar muestra el toast "Mensaje enviado"', () => {
    const fixture = montar();

    escribir(fixture, 'La ruta deberia pasar mas seguido');
    botonEnviar(fixture).click();
    http.expectOne(base).flush(pendiente, { status: 201, statusText: 'Created' });

    expect(toast.current()?.message).toBe('Mensaje enviado');
    expect(toast.current()?.kind).toBe('success');
  });

  it('al enviar limpia el campo para el siguiente comentario', () => {
    const fixture = montar();

    escribir(fixture, 'La ruta deberia pasar mas seguido');
    botonEnviar(fixture).click();
    http.expectOne(base).flush(pendiente, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    const area = (fixture.nativeElement as HTMLElement).querySelector('#text') as HTMLTextAreaElement;
    expect(area.value).toBe('');
  });

  /**
   * El enlace y la palabra prohibida NO se validan en el cliente a propósito: la regla
   * vive en el backend. Lo que esta pantalla tiene que hacer bien es mostrar el mensaje
   * que llega, sin reemplazarlo por uno genérico.
   */
  it('muestra el mensaje del backend cuando rechaza el comentario', () => {
    const fixture = montar();

    escribir(fixture, 'Entren a spam.com ya mismo');
    botonEnviar(fixture).click();
    http.expectOne(base).flush(
      { status: 400, detail: 'El comentario no puede incluir enlaces' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(texto(fixture)).toContain('El comentario no puede incluir enlaces');
  });

  it('un error sin cuerpo cae en un mensaje propio y no deja la pantalla muda', () => {
    const fixture = montar();

    escribir(fixture, 'La ruta deberia pasar mas seguido');
    botonEnviar(fixture).click();
    http.expectOne(base).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos enviar tu comentario.');
  });

  // --- Mis comentarios ------------------------------------------------------

  it('sin comentarios muestra un aviso y no una lista vacía', () => {
    const fixture = montar([]);

    expect(texto(fixture)).toContain('Todavía no has escrito ninguno.');
  });

  it('cada comentario muestra su estado y el nombre del autor', () => {
    const fixture = montar([pendiente, respondido]);
    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('li');

    expect(items[0].textContent).toContain('Ana');
    expect(items[0].textContent).toContain('Pendiente');
    expect(items[1].textContent).toContain('Respondido');
  });

  it('la respuesta del administrador es visible en el comentario respondido', () => {
    const fixture = montar([respondido]);

    expect(texto(fixture)).toContain('Respuesta del administrador');
    expect(texto(fixture)).toContain('Ya agregamos el barrio al recorrido');
  });

  // --- Editar y borrar solo si está pendiente (SCRUM-94 y SCRUM-95) ---------

  it('un comentario pendiente ofrece editar y borrar', () => {
    const fixture = montar([pendiente]);

    expect(boton(fixture, 'Editar')).toBeDefined();
    expect(boton(fixture, 'Borrar')).toBeDefined();
  });

  it('un comentario respondido no ofrece editar ni borrar, y lo dice', () => {
    const fixture = montar([respondido]);

    expect(boton(fixture, 'Editar')).toBeUndefined();
    expect(boton(fixture, 'Borrar')).toBeUndefined();
    expect(texto(fixture)).toContain('Ya respondido: no se puede editar ni borrar.');
  });

  it('editar un comentario manda el texto nuevo y actualiza la tarjeta', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Editar')?.click();
    fixture.detectChanges();

    const area = (fixture.nativeElement as HTMLElement)
      .querySelector('#editar-5') as HTMLTextAreaElement;
    expect(area.value).toBe(pendiente.text);
    area.value = 'Comentario corregido por Ana';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    boton(fixture, 'Guardar')?.click();
    const req = http.expectOne(`${base}/5`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ text: 'Comentario corregido por Ana' });
    req.flush({ ...pendiente, text: 'Comentario corregido por Ana' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Comentario corregido por Ana');
  });

  it('cancelar la edición deja el comentario como estaba', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Editar')?.click();
    fixture.detectChanges();
    boton(fixture, 'Cancelar')?.click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#editar-5')).toBeNull();
    expect(texto(fixture)).toContain(pendiente.text);
  });

  it('no deja guardar una edición por debajo del mínimo', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Editar')?.click();
    fixture.detectChanges();
    const area = (fixture.nativeElement as HTMLElement)
      .querySelector('#editar-5') as HTMLTextAreaElement;
    area.value = 'corto';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(boton(fixture, 'Guardar')?.disabled).toBe(true);
  });

  /**
   * La confirmación es parte de la tarjeta y no un `confirm()` del navegador: un
   * diálogo nativo bloquea la página, no se puede estilar y no se recorre por teclado
   * igual que el resto de la interfaz.
   */
  it('borrar pide confirmación en la tarjeta antes de llamar al backend', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Borrar')?.click();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('¿Borrar este comentario?');
    // Todavía no se llamó a nada: http.verify() del afterEach lo confirma.

    boton(fixture, 'Sí, borrar')?.click();
    const req = http.expectOne(`${base}/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('Todavía no has escrito ninguno.');
  });

  it('decir "No" en la confirmación no borra nada', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Borrar')?.click();
    fixture.detectChanges();
    boton(fixture, 'No')?.click();
    fixture.detectChanges();

    expect(texto(fixture)).toContain(pendiente.text);
    expect(boton(fixture, 'Sí, borrar')).toBeUndefined();
  });

  /**
   * El caso de carrera que justifica tratar el 409 distinto: el administrador responde
   * mientras esta pantalla está abierta. Lo que se ve ya no corresponde, así que se
   * recarga la lista para mostrar la respuesta y dejar el comentario bloqueado.
   */
  it('un 409 al editar muestra el mensaje del backend y recarga la lista', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Editar')?.click();
    fixture.detectChanges();
    boton(fixture, 'Guardar')?.click();

    http.expectOne(`${base}/5`).flush(
      { status: 409, detail: 'El comentario ya fue respondido y no se puede editar ni borrar' },
      { status: 409, statusText: 'Conflict' },
    );
    // La recarga llega sola, sin que el usuario tenga que refrescar.
    http.expectOne(`${base}/me`).flush([{ ...pendiente, status: 'ANSWERED', reply: 'Ya lo revisamos', editable: false }]);
    fixture.detectChanges();

    expect(texto(fixture)).toContain('El comentario ya fue respondido y no se puede editar ni borrar');
    expect(texto(fixture)).toContain('Ya lo revisamos');
    expect(boton(fixture, 'Editar')).toBeUndefined();
  });

  it('un 409 al borrar también recarga la lista', () => {
    const fixture = montar([pendiente]);

    boton(fixture, 'Borrar')?.click();
    fixture.detectChanges();
    boton(fixture, 'Sí, borrar')?.click();

    http.expectOne(`${base}/5`).flush(
      { status: 409, detail: 'El comentario ya fue respondido' },
      { status: 409, statusText: 'Conflict' },
    );
    http.expectOne(`${base}/me`).flush([{ ...pendiente, status: 'ANSWERED', reply: 'Ya lo revisamos', editable: false }]);
    fixture.detectChanges();

    expect(texto(fixture)).toContain('El comentario ya fue respondido');
    expect(texto(fixture)).toContain('Ya lo revisamos');
  });

  it('si falla la carga inicial lo dice en vez de quedarse vacía', () => {
    const fixture = TestBed.createComponent(CommentsComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/me`).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('No pudimos cargar tus comentarios.');
  });
});
