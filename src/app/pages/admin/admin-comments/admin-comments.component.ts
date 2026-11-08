import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommentService } from '../../../services/comment.service';
import { ToastService } from '../../../components/toast/toast.service';
import { ProblemDetail } from '../../../models/auth.model';
import { Comment, CommentStatus } from '../../../models/comment.model';

/** Opciones del filtro. `'TODOS'` no es un estado del backend: es la ausencia de filtro. */
type Filtro = 'TODOS' | CommentStatus;

/**
 * Panel de comentarios del administrador (RF-14, SCRUM-103).
 *
 * La ruta lleva `authGuard` y `adminGuard`, pero **el guard no es lo que protege los
 * datos**: cualquiera puede editar su `localStorage` y entrar. Lo que protege es
 * Spring Security en el backend, que exige rol ADMIN en todo `/api/admin/**`
 * (SCRUM-104). Si alguien fuerza esta pantalla sin el rol, el listado responde 403 y
 * aquí no se pinta ni un comentario — por eso el 403 tiene su propio mensaje y no cae
 * en el error genérico.
 *
 * **El orden lo decide el backend.** Sin filtro llegan los pendientes primero y,
 * dentro de cada grupo, del más reciente al más antiguo. Reordenar aquí duplicaría una
 * regla que ya vive en la consulta y obligaría a traer la tabla completa.
 *
 * **Responder y corregir son la misma acción**, no dos: el criterio de RF-14 dice "una
 * respuesta por comentario; si el administrador necesita corregir su respuesta, la
 * edita, no crea una segunda". De ahí que responder algo ya respondido sea 200 y no un
 * conflicto, y que el formulario arranque con la respuesta anterior ya escrita.
 */
@Component({
  selector: 'app-admin-comments',
  standalone: true,
  template: `
    <div class="fr-card" style="max-width: 760px; margin: 2rem auto;">
      <h1 class="fr-titulo-1" style="margin-bottom: var(--space-2);">Comentarios de los usuarios</h1>
      <p style="color: var(--tinta-suave); margin-bottom: var(--space-6);">
        Los pendientes salen primero. Responder bloquea el comentario para que su autor no lo cambie.
      </p>

      <!-- Filtro por estado -->
      <div role="group" aria-label="Filtrar por estado" class="fr-filtros">
        @for (opcion of filtros; track opcion.valor) {
          <button type="button"
                  class="fr-btn"
                  [class.fr-btn-primario]="filtro() === opcion.valor"
                  [attr.aria-pressed]="filtro() === opcion.valor"
                  (click)="cambiarFiltro(opcion.valor)">{{ opcion.etiqueta }}</button>
        }
      </div>

      @if (loading()) {
        <p style="color: var(--tinta-suave);">Cargando comentarios...</p>
      } @else if (loadError()) {
        <p class="fr-alerta">{{ loadError() }}</p>
      } @else if (comments().length === 0) {
        <p style="color: var(--tinta-suave);">{{ mensajeVacio() }}</p>
      } @else {
        <p style="color: var(--tinta-suave); font-size: 0.9rem;">
          {{ pendientes() }} pendiente(s) de {{ comments().length }} en pantalla
        </p>

        <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-4);">
          @for (c of comments(); track c.id) {
            <li class="fr-comentario">
              <div class="fr-comentario__cabecera">
                <strong>{{ c.authorName }}</strong>
                <span class="fr-chip" [class.fr-chip--respondido]="c.status === 'ANSWERED'">
                  {{ c.status === 'ANSWERED' ? 'Respondido' : 'Pendiente' }}
                </span>
              </div>

              <p class="fr-comentario__texto">{{ c.text }}</p>

              @if (c.reply && replyingId() !== c.id) {
                <blockquote class="fr-respuesta">
                  <span class="fr-respuesta__quien">Tu respuesta</span>
                  {{ c.reply }}
                </blockquote>
              }

              @if (replyingId() === c.id) {
                <div class="fr-campo">
                  <label class="fr-etiqueta" [attr.for]="'respuesta-' + c.id">
                    {{ c.reply ? 'Corregir la respuesta' : 'Responder' }}
                  </label>
                  <textarea
                    [id]="'respuesta-' + c.id"
                    class="fr-input"
                    rows="3"
                    [attr.maxlength]="maxReplyLength"
                    [value]="replyText()"
                    (input)="onReplyInput($event)"
                    placeholder="Ej. Ya agregamos el barrio al recorrido de esa ruta"></textarea>
                  <p class="fr-ayuda" aria-live="polite">
                    {{ replyText().trim().length }}/{{ maxReplyLength }} caracteres
                  </p>
                  @if (rowError() === c.id && rowMessage()) {
                    <p class="fr-ayuda-error">{{ rowMessage() }}</p>
                  }
                </div>
                <div class="fr-comentario__acciones">
                  <button type="button" class="fr-btn fr-btn-primario"
                          [disabled]="!replyValid() || busyId() === c.id"
                          (click)="enviarRespuesta(c)">
                    {{ busyId() === c.id ? 'Enviando...' : 'Guardar respuesta' }}
                  </button>
                  <button type="button" class="fr-btn" (click)="cancelarRespuesta()">Cancelar</button>
                </div>
              } @else {
                @if (rowError() === c.id && rowMessage()) {
                  <p class="fr-ayuda-error">{{ rowMessage() }}</p>
                }
                <div class="fr-comentario__acciones">
                  <button type="button" class="fr-btn" (click)="empezarRespuesta(c)">
                    {{ c.reply ? 'Editar respuesta' : 'Responder' }}
                  </button>
                </div>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .fr-filtros {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      margin-bottom: var(--space-4);
    }
    .fr-comentario {
      border: var(--trazo-1) solid var(--borde);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .fr-comentario__cabecera {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .fr-comentario__texto { margin: 0; overflow-wrap: anywhere; }
    .fr-comentario__acciones {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    .fr-chip {
      font-size: 0.75rem;
      padding: 2px var(--space-2);
      border-radius: var(--radius-sm);
      border: var(--trazo-1) solid var(--borde);
      background: var(--indigo-suave, #EEF2FF);
      white-space: nowrap;
    }
    .fr-chip--respondido { background: #D9F99D; }
    .fr-respuesta {
      margin: 0;
      padding: var(--space-3);
      border-left: var(--trazo-2) solid var(--indigo, #4F46E5);
      background: var(--indigo-suave, #EEF2FF);
      border-radius: var(--radius-sm);
      overflow-wrap: anywhere;
    }
    .fr-respuesta__quien {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--indigo, #4F46E5);
      margin-bottom: var(--space-1);
    }
  `],
})
export class AdminCommentsComponent implements OnInit {
  private readonly comentarios = inject(CommentService);
  private readonly toast = inject(ToastService);

  /** Mismo límite que `Feedback.MAX_REPLY_LENGTH` en el backend. */
  protected readonly maxReplyLength = 500;

  protected readonly filtros: ReadonlyArray<{ valor: Filtro; etiqueta: string }> = [
    { valor: 'TODOS', etiqueta: 'Todos' },
    { valor: 'PENDING', etiqueta: 'Pendientes' },
    { valor: 'ANSWERED', etiqueta: 'Respondidos' },
  ];

  protected readonly comments = signal<Comment[]>([]);
  protected readonly filtro = signal<Filtro>('TODOS');
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly replyingId = signal<number | null>(null);
  protected readonly replyText = signal('');
  protected readonly busyId = signal<number | null>(null);
  protected readonly rowError = signal<number | null>(null);
  protected readonly rowMessage = signal<string | null>(null);

  protected readonly pendientes = computed(
    () => this.comments().filter((c) => c.status === 'PENDING').length,
  );

  protected readonly replyValid = computed(() => {
    const length = this.replyText().trim().length;
    return length > 0 && length <= this.maxReplyLength;
  });

  protected readonly mensajeVacio = computed(() => {
    switch (this.filtro()) {
      case 'PENDING':
        return 'No hay comentarios pendientes. Todo respondido.';
      case 'ANSWERED':
        return 'Todavía no has respondido ninguno.';
      default:
        return 'Nadie ha dejado comentarios todavía.';
    }
  });

  ngOnInit(): void {
    this.load();
  }

  cambiarFiltro(valor: Filtro): void {
    if (this.filtro() === valor) return;
    this.filtro.set(valor);
    this.cancelarRespuesta();
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const filtro = this.filtro();

    this.comentarios.allComments(filtro === 'TODOS' ? undefined : filtro).subscribe({
      next: (list) => {
        this.comments.set(list);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        // El 403 merece mensaje propio: significa que la cuenta no es administradora,
        // no que el servidor falló. Es el caso de alguien que forzó la ruta.
        this.loadError.set(err.status === 403
          ? 'Tu cuenta no tiene permiso de administrador. Si acabas de recibirlo, cierra sesión y vuelve a entrar: el rol viaja dentro del token.'
          : 'No pudimos cargar los comentarios. Inténtalo de nuevo.');
      },
    });
  }

  empezarRespuesta(comment: Comment): void {
    this.replyingId.set(comment.id);
    // Arranca con la respuesta anterior ya escrita: corregir es editar lo que había,
    // no escribir de cero.
    this.replyText.set(comment.reply ?? '');
    this.clearRowError();
  }

  cancelarRespuesta(): void {
    this.replyingId.set(null);
    this.replyText.set('');
    this.clearRowError();
  }

  protected onReplyInput(event: Event): void {
    this.replyText.set((event.target as HTMLTextAreaElement).value);
  }

  enviarRespuesta(comment: Comment): void {
    if (!this.replyValid() || this.busyId() === comment.id) return;
    this.busyId.set(comment.id);
    this.clearRowError();

    this.comentarios.reply(comment.id, this.replyText()).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.replyingId.set(null);
        this.replyText.set('');
        this.toast.show(comment.reply ? 'Respuesta actualizada' : 'Comentario respondido', 'success');

        // Con el filtro en "Pendientes", el comentario que se acaba de responder ya no
        // pertenece a la lista: se quita en vez de dejarlo ahí contradiciendo al
        // filtro. Con los otros filtros se reemplaza en el sitio.
        if (this.filtro() === 'PENDING') {
          this.comments.update((list) => list.filter((c) => c.id !== updated.id));
        } else {
          this.comments.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
        }
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set(null);
        this.rowError.set(comment.id);
        const body = err.error as ProblemDetail | undefined;
        // Se prefiere el mensaje del backend: es el que dice cuál regla falló (una
        // respuesta vacía o demasiado larga dan 400 con su detalle).
        this.rowMessage.set(body?.detail ?? 'No pudimos guardar la respuesta.');

        // El comentario desapareció entre la carga y la respuesta: la lista que se ve
        // ya no corresponde.
        if (err.status === 404) {
          this.replyingId.set(null);
          this.load();
        }
      },
    });
  }

  private clearRowError(): void {
    this.rowError.set(null);
    this.rowMessage.set(null);
  }
}
