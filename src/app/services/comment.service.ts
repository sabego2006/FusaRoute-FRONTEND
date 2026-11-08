import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Comment,
  CommentStatus,
  UnreadReplies,
} from '../models/comment.model';

/**
 * Cliente HTTP de la caja de comentarios (RF-08) y del panel del administrador
 * (RF-14).
 *
 * Es el único lugar del frontend que habla con `/api/comments` y
 * `/api/admin/comments`. Ningún componente usa `HttpClient` directamente: es la mitad
 * frontend del atributo de mantenibilidad que evalúa el docente.
 *
 * Los métodos del usuario y los del administrador conviven aquí porque son el mismo
 * recurso visto desde dos lados, y partirlos en dos servicios duplicaría la URL base.
 * Lo que impide que un usuario normal llame a los de administrador no es este archivo
 * sino Spring Security en el backend, que responde 403 (SCRUM-104).
 */
@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/comments`;
  private readonly adminUrl = `${environment.apiUrl}/api/admin/comments`;

  // --- Usuario autenticado (RF-08) ------------------------------------------

  /**
   * Deja un comentario. El backend responde **201** con el comentario creado.
   *
   * El nombre del autor NO se envía: lo resuelve el backend leyendo el perfil del
   * usuario autenticado. Mandarlo desde aquí permitiría firmar un comentario con el
   * nombre de otro.
   */
  submit(text: string): Observable<Comment> {
    return this.http.post<Comment>(this.url, { text });
  }

  /** Mis comentarios, del más reciente al más antiguo, con estado y respuesta. */
  myComments(): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.url}/me`);
  }

  /**
   * Edita mi comentario. El backend responde **409** si ya fue respondido y **404**
   * si no existe o es de otro usuario.
   */
  edit(id: number, text: string): Observable<Comment> {
    return this.http.put<Comment>(`${this.url}/${id}`, { text });
  }

  /** Borra mi comentario. Mismos 404 y 409 que `edit`. */
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * Cuántas respuestas nuevas tengo desde mi ingreso anterior (SCRUM-101).
   *
   * El backend compara contra el ingreso **anterior** y no el actual, así que llamar
   * a esto justo después de iniciar sesión devuelve algo útil. En el primer ingreso de
   * una cuenta devuelve 0: no hay un "antes" contra el que comparar.
   */
  unreadReplies(): Observable<UnreadReplies> {
    return this.http.get<UnreadReplies>(`${this.url}/me/unread-count`);
  }

  // --- Administrador (RF-14) -------------------------------------------------

  /**
   * Todos los comentarios. Sin `status` salen los **pendientes primero** y, dentro de
   * cada grupo, del más reciente al más antiguo; con `status` salen solo los de ese
   * estado.
   *
   * El orden lo decide el backend, no esta pantalla: ordenar aquí obligaría a traer
   * la tabla completa y duplicaría una regla que ya está en la consulta.
   */
  allComments(status?: CommentStatus): Observable<Comment[]> {
    return this.http.get<Comment[]>(this.adminUrl, {
      params: status ? { status } : {},
    });
  }

  /**
   * Responde el comentario, o **reemplaza** la respuesta si ya tenía una: una
   * respuesta por comentario, no un hilo. Por eso es PUT y no POST, y por eso
   * responder algo ya respondido es 200 y no 409.
   */
  reply(id: number, reply: string): Observable<Comment> {
    return this.http.put<Comment>(`${this.adminUrl}/${id}/reply`, { reply });
  }
}
