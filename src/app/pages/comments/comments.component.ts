import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommentService } from '../../services/comment.service';
import { ToastService } from '../../components/toast/toast.service';
import { ProblemDetail } from '../../models/auth.model';
import { UnreadRepliesStore } from '../../core/unread-replies.store';
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  Comment,
} from '../../models/comment.model';

/**
 * Longitud del comentario medida sobre el texto RECORTADO.
 *
 * No se usan `Validators.minLength` y `Validators.maxLength` porque miden el valor en
 * bruto, y el backend mide el recortado: con los de Angular, un comentario de ocho
 * letras rodeado de espacios pasaba la validación del formulario, el botón se
 * habilitaba y el servidor lo rechazaba con 400. El usuario veía un error que el
 * formulario podía haberle ahorrado.
 */
function trimmedLength(control: AbstractControl): ValidationErrors | null {
  const length = ((control.value as string | null) ?? '').trim().length;
  if (length < COMMENT_MIN_LENGTH) {
    return { comentarioCorto: { requerido: COMMENT_MIN_LENGTH, actual: length } };
  }
  if (length > COMMENT_MAX_LENGTH) {
    return { comentarioLargo: { maximo: COMMENT_MAX_LENGTH, actual: length } };
  }
  return null;
}

/**
 * Caja de comentarios del usuario (RF-08, SCRUM-96 y SCRUM-93).
 *
 * La pantalla exige sesión: la ruta lleva `authGuard`. No hay versión pública porque
 * el criterio de aceptación pide que cada comentario muestre el nombre de quien lo
 * escribió, y sin cuenta no hay nombre que mostrar.
 *
 * <b>Qué valida esta pantalla y qué no.</b> El contador de caracteres y el botón
 * deshabilitado son comodidad para el usuario: evitan un viaje al servidor para que le
 * digan algo que ya se sabía. Las otras dos reglas de RF-08 —sin enlaces y el banco de
 * palabras prohibidas— **no se replican aquí a propósito**. Replicarlas significaría
 * mantener la misma regla en dos lugares y traerse el banco de palabras al navegador,
 * donde cualquiera lo puede leer. Cuando el backend las rechaza, se muestra su mensaje
 * tal como llega.
 *
 * Los botones de editar y borrar se pintan según `editable`, que **calcula el
 * backend**. Esconderlos no es seguridad: el backend vuelve a verificar la regla en
 * cada PUT y DELETE. Si el administrador responde mientras esta pantalla está abierta,
 * la petición falla con 409 y entonces se recarga la lista para mostrar la respuesta
 * que acaba de aparecer — por eso el 409 se trata distinto de cualquier otro error.
 */
@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="fr-card" style="max-width: 640px; margin: 2rem auto;">
      <h1 class="fr-titulo-1" style="margin-bottom: var(--space-2);">Comentarios</h1>
      <p style="color: var(--tinta-suave); margin-bottom: var(--space-6);">
        Cuéntanos qué mejorar. Un administrador lee todos los comentarios y te responde aquí mismo.
      </p>

      <!-- Dejar un comentario (SCRUM-92 en el backend, SCRUM-96 aquí) -->
      <form [formGroup]="form" (ngSubmit)="submit()" style="display: flex; flex-direction: column; gap: var(--space-3);">
        <div class="fr-campo">
          <label class="fr-etiqueta" for="text">Tu comentario</label>
          <textarea
            id="text"
            class="fr-input"
            formControlName="text"
            rows="3"
            [attr.maxlength]="maxLength"
            [attr.aria-describedby]="'contador-texto'"
            placeholder="Ej. La ruta del Centro deberia pasar mas seguido en la tarde"></textarea>

          <!-- El contador va en aria-live para que un lector de pantalla anuncie
               cuántos caracteres faltan sin tener que salir del campo. -->
          <p id="contador-texto" class="fr-ayuda" aria-live="polite"
             [style.color]="textLength() < minLength ? 'var(--tinta-suave)' : 'var(--tinta)'">
            {{ textLength() }}/{{ maxLength }} caracteres
            @if (textLength() > 0 && textLength() < minLength) {
              <span> · faltan {{ minLength - textLength() }} para el mínimo</span>
            }
          </p>

          @if (submitError()) {
            <p class="fr-ayuda-error">{{ submitError() }}</p>
          }
        </div>

        <button type="submit" class="fr-btn fr-btn-primario" [disabled]="form.invalid || sending()">
          {{ sending() ? 'Enviando...' : 'Enviar comentario' }}
        </button>
      </form>

      <hr style="margin: var(--space-8) 0; border: 0; border-top: var(--trazo-1) solid var(--borde);">

      <!-- Mis comentarios, con estado y respuesta -->
      <h2 class="fr-titulo-2" style="margin-bottom: var(--space-4);">Mis comentarios</h2>

      @if (loading()) {
        <p style="color: var(--tinta-suave);">Cargando tus comentarios...</p>
      } @else if (loadError()) {
        <p class="fr-alerta">{{ loadError() }}</p>
      } @else if (comments().length === 0) {
        <p style="color: var(--tinta-suave);">Todavía no has escrito ninguno.</p>
      } @else {
        <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-4);">
          @for (c of comments(); track c.id) {
            <li class="fr-comentario">
              <div class="fr-comentario__cabecera">
                <strong>{{ c.authorName }}</strong>
                <span class="fr-chip" [class.fr-chip--respondido]="c.status === 'ANSWERED'">
                  {{ c.status === 'ANSWERED' ? 'Respondido' : 'Pendiente' }}
                </span>
              </div>

              @if (editingId() === c.id) {
                <!-- Editar en el sitio: se reusa el mismo contador y el mismo mínimo -->
                <div class="fr-campo">
                  <label class="fr-etiqueta" [attr.for]="'editar-' + c.id">Editar comentario</label>
                  <textarea
                    [id]="'editar-' + c.id"
                    class="fr-input"
                    rows="3"
                    [attr.maxlength]="maxLength"
                    [value]="editText()"
                    (input)="onEditInput($event)"></textarea>
                  <p class="fr-ayuda" aria-live="polite">{{ editText().trim().length }}/{{ maxLength }} caracteres</p>
                  @if (rowError() === c.id && rowMessage()) {
                    <p class="fr-ayuda-error">{{ rowMessage() }}</p>
                  }
                </div>
                <div class="fr-comentario__acciones">
                  <button type="button" class="fr-btn fr-btn-primario"
                          [disabled]="!editValid() || busyId() === c.id"
                          (click)="saveEdit(c)">Guardar</button>
                  <button type="button" class="fr-btn" (click)="cancelEdit()">Cancelar</button>
                </div>
              } @else {
                <p class="fr-comentario__texto">{{ c.text }}</p>

                @if (c.reply) {
                  <!-- La respuesta del administrador, visible para el autor -->
                  <blockquote class="fr-respuesta">
                    <span class="fr-respuesta__quien">Respuesta del administrador</span>
                    {{ c.reply }}
                  </blockquote>
                }

                @if (rowError() === c.id && rowMessage()) {
                  <p class="fr-ayuda-error">{{ rowMessage() }}</p>
                }

                @if (c.editable) {
                  @if (confirmingId() === c.id) {
                    <!-- Confirmación en la propia tarjeta y no con un confirm() del
                         navegador: un diálogo nativo bloquea la página y no se puede
                         estilar ni navegar por teclado igual que el resto. -->
                    <div class="fr-comentario__acciones">
                      <span style="color: var(--tinta-suave); font-size: 0.9rem;">¿Borrar este comentario?</span>
                      <button type="button" class="fr-btn fr-btn-peligro"
                              [disabled]="busyId() === c.id" (click)="confirmDelete(c)">Sí, borrar</button>
                      <button type="button" class="fr-btn" (click)="confirmingId.set(null)">No</button>
                    </div>
                  } @else {
                    <div class="fr-comentario__acciones">
                      <button type="button" class="fr-btn" (click)="startEdit(c)">Editar</button>
                      <button type="button" class="fr-btn fr-btn-peligro" (click)="confirmingId.set(c.id)">Borrar</button>
                    </div>
                  }
                } @else {
                  <p class="fr-comentario__bloqueado">
                    Ya respondido: no se puede editar ni borrar.
                  </p>
                }
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
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
    .fr-comentario__bloqueado {
      margin: 0;
      font-size: 0.85rem;
      color: var(--tinta-suave);
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
    .fr-btn-peligro { color: var(--rojo-texto, #B91C1C); }
  `],
})
export class CommentsComponent implements OnInit {
  private readonly comentarios = inject(CommentService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly unread = inject(UnreadRepliesStore);

  protected readonly minLength = COMMENT_MIN_LENGTH;
  protected readonly maxLength = COMMENT_MAX_LENGTH;

  protected readonly comments = signal<Comment[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly submitError = signal<string | null>(null);

  /** Comentario que se está editando, o `null` si ninguno. */
  protected readonly editingId = signal<number | null>(null);
  protected readonly editText = signal('');
  /** Comentario con la confirmación de borrado abierta. */
  protected readonly confirmingId = signal<number | null>(null);
  /** Comentario con una petición en vuelo: deshabilita sus botones. */
  protected readonly busyId = signal<number | null>(null);
  /** Comentario cuyo error se está mostrando, y el mensaje del backend. */
  protected readonly rowError = signal<number | null>(null);
  protected readonly rowMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    text: ['', [Validators.required, trimmedLength]],
  });

  /**
   * El valor del campo como signal. `toSignal` sobre `valueChanges` y no un
   * `computed` que lea `form.controls.text.value`: el valor de un FormControl no es
   * un signal, así que un `computed` sobre él nunca se recalcularía y el contador se
   * quedaría clavado en cero. Es uno de los casos en que RxJS es el flujo real
   * (`valueChanges` es un stream) y no un reemplazo gratuito de un signal.
   */
  private readonly textValue = toSignal(this.form.controls.text.valueChanges, { initialValue: '' });

  /**
   * Longitud del texto YA RECORTADO, que es la que cuenta el backend. Si se mostrara
   * la longitud en bruto, un comentario de 8 letras rodeado de espacios parecería
   * cumplir el mínimo y el servidor lo rechazaría igual.
   */
  protected readonly textLength = computed(() => this.textValue().trim().length);

  protected readonly editValid = computed(() => {
    const length = this.editText().trim().length;
    return length >= COMMENT_MIN_LENGTH && length <= COMMENT_MAX_LENGTH;
  });

  ngOnInit(): void {
    // SCRUM-102: abrir esta pantalla ES ver las respuestas, asi que el contador del
    // encabezado se apaga aqui. Se apaga al entrar y no despues de que cargue la
    // lista: si la peticion falla, el usuario ya esta en la pantalla de sus
    // comentarios y dejar el globito encendido no le dice nada nuevo.
    this.unread.clear();
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.comentarios.myComments().subscribe({
      next: (list) => {
        this.comments.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('No pudimos cargar tus comentarios. Inténtalo de nuevo.');
      },
    });
  }

  submit(): void {
    if (this.form.invalid || this.sending()) return;
    this.sending.set(true);
    this.submitError.set(null);

    this.comentarios.submit(this.form.controls.text.value).subscribe({
      next: (created) => {
        this.sending.set(false);
        this.form.reset({ text: '' });
        // SCRUM-93: confirmación transitoria que desaparece sola y no tiene botón.
        // El ToastService ya se cierra solo a los 4 s; no se le agrega ninguna acción.
        this.toast.show('Mensaje enviado', 'success');
        // Se inserta de primero en vez de recargar la lista: el backend ya devolvió el
        // comentario creado, y pedirlo otra vez sería una petición que no aporta nada.
        this.comments.update((list) => [created, ...list]);
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        this.submitError.set(this.messageOf(err, 'No pudimos enviar tu comentario.'));
      },
    });
  }

  startEdit(comment: Comment): void {
    this.editingId.set(comment.id);
    this.editText.set(comment.text);
    this.confirmingId.set(null);
    this.clearRowError();
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editText.set('');
    this.clearRowError();
  }

  protected onEditInput(event: Event): void {
    this.editText.set((event.target as HTMLTextAreaElement).value);
  }

  saveEdit(comment: Comment): void {
    if (!this.editValid() || this.busyId() === comment.id) return;
    this.busyId.set(comment.id);
    this.clearRowError();

    this.comentarios.edit(comment.id, this.editText()).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.editingId.set(null);
        this.comments.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
        this.toast.show('Comentario actualizado', 'success');
      },
      error: (err: HttpErrorResponse) => this.handleRowError(comment.id, err, 'editar'),
    });
  }

  confirmDelete(comment: Comment): void {
    if (this.busyId() === comment.id) return;
    this.busyId.set(comment.id);
    this.clearRowError();

    this.comentarios.remove(comment.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.confirmingId.set(null);
        this.comments.update((list) => list.filter((c) => c.id !== comment.id));
        this.toast.show('Comentario borrado', 'success');
      },
      error: (err: HttpErrorResponse) => this.handleRowError(comment.id, err, 'borrar'),
    });
  }

  /**
   * Un 409 significa que el administrador respondió mientras esta pantalla estaba
   * abierta, así que lo que se ve ya no corresponde: se recarga la lista para mostrar
   * la respuesta y dejar el comentario bloqueado. Cualquier otro error solo se muestra;
   * recargar ahí borraría lo que el usuario estaba escribiendo sin ganar nada.
   */
  private handleRowError(id: number, err: HttpErrorResponse, accion: 'editar' | 'borrar'): void {
    this.busyId.set(null);
    this.confirmingId.set(null);
    this.rowError.set(id);
    this.rowMessage.set(this.messageOf(err, `No pudimos ${accion} el comentario.`));

    if (err.status === 409 || err.status === 404) {
      this.editingId.set(null);
      this.load();
    }
  }

  private clearRowError(): void {
    this.rowError.set(null);
    this.rowMessage.set(null);
  }

  /** Se prefiere siempre el mensaje del backend: es el que explica cuál regla falló. */
  private messageOf(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as ProblemDetail | undefined;
    return body?.detail ?? fallback;
  }
}
