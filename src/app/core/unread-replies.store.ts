import { Injectable, inject, signal } from '@angular/core';
import { CommentService } from '../services/comment.service';

/**
 * Cuántas respuestas nuevas tiene el usuario (RF-14, SCRUM-102).
 *
 * Existe como servicio con estado y no como una llamada dentro del encabezado porque
 * dos pantallas distintas lo tocan: la navegación lo muestra y la caja de comentarios
 * lo limpia. Con la petición metida en el componente del encabezado, "ver mis
 * comentarios" no tendría forma de apagar el contador.
 *
 * **No es una notificación push** — están fuera de alcance este semestre. Es un
 * chequeo del backend que se hace al cargar la sesión, exactamente como lo describe el
 * criterio de aceptación de RF-14.
 *
 * El backend cuenta contra el ingreso **anterior**, así que preguntar justo después de
 * iniciar sesión devuelve algo útil y no cero.
 */
@Injectable({ providedIn: 'root' })
export class UnreadRepliesStore {
  private readonly comments = inject(CommentService);

  readonly count = signal(0);

  /**
   * Pide el conteo al backend. Un fallo deja el contador en cero en vez de propagar el
   * error: es un adorno de la navegación, y romper el encabezado de toda la aplicación
   * porque un contador no cargó sería desproporcionado.
   */
  refresh(): void {
    this.comments.unreadReplies().subscribe({
      next: (res) => this.count.set(res.count),
      error: () => this.count.set(0),
    });
  }

  /**
   * Apaga el contador. Lo llama la caja de comentarios al abrirse: el usuario ya vio
   * las respuestas, así que el aviso cumplió su función.
   *
   * Se limpia solo en el cliente y no se avisa al backend, y conviene saberlo: si el
   * usuario recarga la página, el contador vuelve a aparecer, porque el backend sigue
   * comparando contra su ingreso anterior hasta que vuelva a iniciar sesión. Marcar
   * "visto" del lado del servidor pediría otra columna y otro endpoint; con el alcance
   * de este semestre —sin push y con el aviso atado al ingreso— no se justifica.
   */
  clear(): void {
    this.count.set(0);
  }
}
