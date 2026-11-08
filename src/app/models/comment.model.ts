/**
 * Espeja `CommentResponse` del backend (RF-08 y RF-14, SCRUM-22 y SCRUM-23).
 *
 * El modelo de dominio del backend se llama `Feedback`, pero la URL y los tipos de
 * aquí dicen "comment": la interfaz le habla al usuario, y el usuario deja
 * "comentarios". El nombre del modelo del backend lo fija su propio CLAUDE.md.
 *
 * No trae `userId`, igual que el historial: el id interno de la cuenta no le sirve a
 * ninguna pantalla. `authorName` es lo que identifica al autor, y el criterio de
 * aceptación pide justo eso — el comentario no es anónimo.
 */
export interface Comment {
  id: number;
  /** Nombre con el que se escribió el comentario, copiado del perfil en ese momento. */
  authorName: string;
  text: string;
  status: CommentStatus;
  /** Respuesta del administrador, o `null` mientras siga pendiente. */
  reply: string | null;
  /** Cuándo se respondió, o `null` mientras siga pendiente. */
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Si el autor todavía puede editarlo o borrarlo. **Lo calcula el backend**, no se
   * deduce aquí de `status`: así la regla de "hasta cuándo se puede editar" vive en un
   * solo lugar y esta pantalla la sigue sin cambios si mañana cambia.
   *
   * Sirve para decidir qué botones pintar, y nada más. Esconder un botón no es
   * seguridad: el backend vuelve a verificar la regla en cada PUT y DELETE, y responde
   * 409 si el comentario ya fue respondido.
   */
  editable: boolean;
}

export type CommentStatus = 'PENDING' | 'ANSWERED';

/** Cuerpo de `POST /api/comments` y de `PUT /api/comments/{id}`. */
export interface CommentRequest {
  text: string;
}

/** Cuerpo de `PUT /api/admin/comments/{id}/reply` (RF-14, SCRUM-23). */
export interface CommentReplyRequest {
  reply: string;
}

/**
 * Cuerpo de `GET /api/comments/me/unread-count` (RF-14, SCRUM-101).
 *
 * Cuenta las respuestas recibidas desde el ingreso **anterior** del usuario. Las
 * notificaciones push están fuera de alcance, así que este conteo es lo que reemplaza
 * al aviso proactivo: se pide al cargar la sesión y se pinta como contador.
 */
export interface UnreadReplies {
  count: number;
}

/**
 * Límites del texto del comentario (RF-08).
 *
 * Están aquí para el contador de caracteres y para deshabilitar el botón, que es
 * comodidad para el usuario. **No son la validación**: esa vive en el backend
 * (`Feedback`), que además revisa enlaces y el banco de palabras prohibidas — dos
 * reglas que a propósito no se replican en el cliente.
 */
export const COMMENT_MIN_LENGTH = 10;
export const COMMENT_MAX_LENGTH = 100;
