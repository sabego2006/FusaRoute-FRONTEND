import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnreadRepliesStore } from './unread-replies.store';
import { environment } from '../../environments/environment';

/**
 * Contador de respuestas nuevas (RF-14, SCRUM-102).
 */
describe('UnreadRepliesStore', () => {
  let store: UnreadRepliesStore;
  let http: HttpTestingController;

  const url = `${environment.apiUrl}/api/comments/me/unread-count`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(UnreadRepliesStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('arranca en cero sin pedir nada', () => {
    expect(store.count()).toBe(0);
  });

  it('refresh trae el conteo del backend', () => {
    store.refresh();
    http.expectOne(url).flush({ count: 3 });

    expect(store.count()).toBe(3);
  });

  /**
   * El contador es un adorno de la navegacion: si el backend falla, se apaga en vez de
   * propagar el error. Romper el encabezado de toda la aplicacion porque un contador no
   * cargo seria desproporcionado.
   */
  it('si la peticion falla el contador queda en cero y no propaga el error', () => {
    store.refresh();
    http.expectOne(url).flush(null, { status: 500, statusText: 'Server Error' });

    expect(store.count()).toBe(0);
  });

  it('clear apaga el contador sin llamar al backend', () => {
    store.refresh();
    http.expectOne(url).flush({ count: 2 });

    store.clear();

    // Sin peticion nueva: lo confirma http.verify() del afterEach.
    expect(store.count()).toBe(0);
  });
});
