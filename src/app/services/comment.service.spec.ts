import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CommentService } from './comment.service';
import { Comment } from '../models/comment.model';
import { environment } from '../../environments/environment';

describe('CommentService', () => {
  let service: CommentService;
  let http: HttpTestingController;

  const base = `${environment.apiUrl}/api/comments`;
  const adminBase = `${environment.apiUrl}/api/admin/comments`;

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // --- Usuario autenticado --------------------------------------------------

  it('submit envía POST /api/comments solo con el texto', () => {
    let result: Comment | undefined;
    service.submit('La ruta deberia pasar mas seguido').subscribe((r) => (result = r));

    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'La ruta deberia pasar mas seguido' });
    req.flush(pendiente, { status: 201, statusText: 'Created' });

    expect(result).toEqual(pendiente);
  });

  /**
   * El nombre del autor lo resuelve el backend leyendo el perfil. Si se enviara desde
   * aquí, cualquiera podría firmar un comentario con el nombre de otro.
   */
  it('submit no envía el nombre del autor ni el id del usuario', () => {
    service.submit('Comentario cualquiera valido').subscribe();

    const req = http.expectOne(base);
    expect(Object.keys(req.request.body as object)).toEqual(['text']);
    req.flush(pendiente, { status: 201, statusText: 'Created' });
  });

  it('myComments pide GET /api/comments/me', () => {
    let result: Comment[] | undefined;
    service.myComments().subscribe((r) => (result = r));

    const req = http.expectOne(`${base}/me`);
    expect(req.request.method).toBe('GET');
    req.flush([pendiente]);

    expect(result).toEqual([pendiente]);
  });

  it('edit envía PUT /api/comments/{id}', () => {
    service.edit(5, 'Comentario corregido por Ana').subscribe();

    const req = http.expectOne(`${base}/5`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ text: 'Comentario corregido por Ana' });
    req.flush({ ...pendiente, text: 'Comentario corregido por Ana' });
  });

  it('remove envía DELETE /api/comments/{id}', () => {
    service.remove(5).subscribe();

    const req = http.expectOne(`${base}/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  /**
   * El 409 de "ya fue respondido" tiene que llegar al componente con su status
   * intacto: es lo que le permite distinguirlo del 404 y recargar la lista en vez de
   * mostrar un error genérico.
   */
  it('propaga el 409 de un comentario ya respondido', () => {
    let status: number | undefined;
    let detail: string | undefined;
    service.edit(5, 'Intento de cambiar el texto').subscribe({
      error: (e) => {
        status = e.status;
        detail = e.error?.detail;
      },
    });

    http.expectOne(`${base}/5`).flush(
      { status: 409, detail: 'El comentario ya fue respondido y no se puede editar ni borrar' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(status).toBe(409);
    expect(detail).toBe('El comentario ya fue respondido y no se puede editar ni borrar');
  });

  it('propaga el 400 de validación con el mensaje del backend', () => {
    let detail: string | undefined;
    service.submit('corto').subscribe({ error: (e) => (detail = e.error?.detail) });

    http.expectOne(base).flush(
      { status: 400, detail: 'El comentario debe tener entre 10 y 100 caracteres' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(detail).toBe('El comentario debe tener entre 10 y 100 caracteres');
  });

  it('unreadReplies pide GET /api/comments/me/unread-count', () => {
    let count: number | undefined;
    service.unreadReplies().subscribe((r) => (count = r.count));

    const req = http.expectOne(`${base}/me/unread-count`);
    expect(req.request.method).toBe('GET');
    req.flush({ count: 3 });

    expect(count).toBe(3);
  });

  // --- Administrador --------------------------------------------------------

  it('allComments sin filtro pide GET /api/admin/comments sin parámetros', () => {
    service.allComments().subscribe();

    const req = http.expectOne(adminBase);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([pendiente]);
  });

  it('allComments con estado manda el parámetro status', () => {
    service.allComments('PENDING').subscribe();

    const req = http.expectOne((r) => r.url === adminBase && r.params.get('status') === 'PENDING');
    expect(req.request.method).toBe('GET');
    req.flush([pendiente]);
  });

  it('reply envía PUT /api/admin/comments/{id}/reply', () => {
    service.reply(5, 'Ya agregamos el barrio al recorrido').subscribe();

    const req = http.expectOne(`${adminBase}/5/reply`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ reply: 'Ya agregamos el barrio al recorrido' });
    req.flush({ ...pendiente, status: 'ANSWERED', reply: 'Ya agregamos el barrio al recorrido', editable: false });
  });

  /**
   * Un USER que llame a un endpoint de administrador recibe 403 del backend. El
   * frontend no lo previene — esconder un botón no es seguridad — pero sí tiene que
   * dejar pasar el error para poder mostrarlo.
   */
  it('propaga el 403 de un endpoint de administrador', () => {
    let status: number | undefined;
    service.allComments().subscribe({ error: (e) => (status = e.status) });

    http.expectOne(adminBase).flush(null, { status: 403, statusText: 'Forbidden' });

    expect(status).toBe(403);
  });
});
