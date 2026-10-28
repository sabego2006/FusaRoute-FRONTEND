import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { TotpService } from '../../services/totp.service';
import { ToastService } from '../toast/toast.service';
import { TotpEnrollResponse } from '../../models/totp.model';
import { ProblemDetail } from '../../models/auth.model';
import { copyText } from '../../lib/clipboard';
import { downloadText } from '../../lib/download';
import { isMobileDevice } from '../../lib/device';
import { parseLoginError } from '../../lib/login-error';

/**
 * Enrolamiento de TOTP: QR + deep link + secret copiable, primer código y códigos de respaldo.
 *
 * Lo usan el login (enrolamiento forzado, con el enrollmentToken como Bearer) y el perfil
 * (re-enrolamiento, con el token completo). El interceptor decide cuál adjuntar.
 */
@Component({
  selector: 'app-totp-enroll',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (recoveryCodes(); as codes) {
      <section aria-labelledby="respaldo-titulo">
        <h2 id="respaldo-titulo" class="fr-titulo-3" style="margin-bottom: var(--space-2);">
          Guarda tus códigos de respaldo
        </h2>
        <div class="fr-alerta" role="alert" style="margin-bottom: var(--space-4);">
          <strong>Guárdalos ahora:</strong> no se volverán a mostrar. Cada uno sirve una sola vez si
          pierdes tu teléfono.
        </div>

        <ul
          class="fr-lista"
          style="margin-bottom: var(--space-4);"
          aria-label="Códigos de respaldo"
        >
          @for (code of codes; track code) {
            <li>
              <code style="font-size: 16px; user-select: all;">{{ code }}</code>
            </li>
          }
        </ul>

        <div
          style="display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4);"
        >
          <button type="button" class="fr-btn" (click)="copyCodes()">Copiar códigos</button>
          <button type="button" class="fr-btn" (click)="downloadCodes()">Descargar .txt</button>
        </div>

        <button type="button" class="fr-btn fr-btn-primario fr-btn-bloque" (click)="finish()">
          Ya los guardé, continuar
        </button>
      </section>
    } @else if (loadError()) {
      <div class="fr-alerta" role="alert" style="margin-bottom: var(--space-4);">
        <strong>Error:</strong> {{ loadError() }}
      </div>
      <button type="button" class="fr-btn" (click)="loadEnrollment()">Reintentar</button>
    } @else if (enrollment(); as e) {
      <section aria-labelledby="enrolar-titulo">
        <h2 id="enrolar-titulo" class="fr-titulo-3" style="margin-bottom: var(--space-2);">
          Configura tu app autenticadora
        </h2>
        <p class="fr-texto-sm" style="margin-bottom: var(--space-4);">
          Usa Microsoft Authenticator, Google Authenticator u otra app compatible.
        </p>

        <div style="display: flex; flex-direction: column; gap: var(--space-4);">
          <div [style.order]="mobile ? 2 : 1" style="text-align: center;">
            <img
              [src]="qrSrc()"
              alt="Código QR para agregar FusaRoute a tu app autenticadora"
              width="200"
              height="200"
              style="max-width: 100%; height: auto; border: 3px solid var(--borde);"
            />
          </div>

          @if (deepLink(); as link) {
            <a
              class="fr-btn fr-btn-bloque"
              [class.fr-btn-primario]="mobile"
              [href]="link"
              [style.order]="mobile ? 1 : 2"
              style="box-sizing: border-box; text-align: center; justify-content: center;"
            >
              Abrir mi app autenticadora
            </a>
          }

          <div [style.order]="3">
            <p class="fr-etiqueta" id="secret-etiqueta">¿No puedes escanear? Escribe esta clave</p>
            <div style="display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center;">
              <code
                aria-labelledby="secret-etiqueta"
                style="word-break: break-all; user-select: all; flex: 1 1 12rem; min-width: 0;"
                >{{ e.secret }}</code
              >
              <button type="button" class="fr-btn" (click)="copySecret()">Copiar</button>
            </div>
          </div>
        </div>

        <form
          [formGroup]="codeForm"
          (ngSubmit)="confirm()"
          style="display: flex; flex-direction: column; gap: var(--space-4); margin-top: var(--space-6);"
        >
          <div class="fr-campo">
            <label class="fr-etiqueta" for="totp-code">Código de 6 dígitos de tu app</label>
            <input
              id="totp-code"
              class="fr-input"
              formControlName="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              placeholder="123456"
              [class.is-invalido]="!!codeError()"
              [attr.aria-invalid]="codeError() ? 'true' : null"
              [attr.aria-describedby]="codeError() ? 'totp-code-error' : null"
            />
            @if (codeError()) {
              <p id="totp-code-error" class="fr-ayuda-error" role="alert">{{ codeError() }}</p>
            }
          </div>

          <button
            type="submit"
            class="fr-btn fr-btn-primario fr-btn-bloque"
            [disabled]="codeForm.invalid || confirming()"
          >
            {{ confirming() ? 'Verificando...' : 'Activar verificación' }}
          </button>
        </form>
      </section>
    } @else {
      <p class="fr-texto-sm" role="status">Preparando tu código QR...</p>
    }
  `,
  styles: [],
})
export class TotpEnrollComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly totp = inject(TotpService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  /** El usuario guardó sus códigos de respaldo y ya quedó con sesión completa. */
  readonly enrolled = output<void>();
  /** El enrollmentToken venció o fue rechazado: el padre debe volver al paso de credenciales. */
  readonly expired = output<void>();

  readonly mobile = isMobileDevice();

  readonly enrollment = signal<TotpEnrollResponse | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly confirming = signal(false);
  readonly codeError = signal<string | null>(null);
  readonly recoveryCodes = signal<string[] | null>(null);

  readonly qrSrc = computed(() => `data:image/png;base64,${this.enrollment()?.qrPngBase64 ?? ''}`);

  /** Solo se confía en un esquema otpauth://; Angular bloquearía el resto de esquemas ajenos a http. */
  readonly deepLink = computed<SafeUrl | null>(() => {
    const uri = this.enrollment()?.otpauthUri;
    return uri?.startsWith('otpauth://') ? this.sanitizer.bypassSecurityTrustUrl(uri) : null;
  });

  readonly codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  ngOnInit(): void {
    this.loadEnrollment();
  }

  loadEnrollment(): void {
    this.loadError.set(null);
    const forced = this.auth.enrollmentToken() !== null;

    this.totp.enroll().subscribe({
      next: (res) => this.enrollment.set(res),
      error: (err: HttpErrorResponse) => {
        if (forced && (err.status === 401 || err.status === 403)) {
          this.expired.emit();
          return;
        }
        this.loadError.set('No pudimos preparar la verificación. Inténtalo de nuevo.');
      },
    });
  }

  confirm(): void {
    if (this.codeForm.invalid || this.confirming()) return;
    this.confirming.set(true);
    this.codeError.set(null);
    const forced = this.auth.enrollmentToken() !== null;

    this.totp.confirm(this.codeForm.controls.code.value).subscribe({
      next: (res) => {
        this.confirming.set(false);
        this.auth.applySession(res);
        this.recoveryCodes.set(res.recoveryCodes);
      },
      error: (err: HttpErrorResponse) => {
        this.confirming.set(false);
        const badCode =
          parseLoginError(err.error)?.error === 'INVALID_TOTP' ||
          err.status === 400 ||
          err.status === 422;

        if (badCode) {
          this.codeError.set('Código incorrecto. Revisa tu app e inténtalo de nuevo.');
        } else if (forced && (err.status === 401 || err.status === 403)) {
          this.expired.emit();
        } else {
          const body = err.error as ProblemDetail | undefined;
          this.codeError.set(body?.detail ?? 'No pudimos verificar el código. Inténtalo de nuevo.');
        }
      },
    });
  }

  async copySecret(): Promise<void> {
    const secret = this.enrollment()?.secret;
    if (!secret) return;
    const ok = await copyText(secret);
    this.toast.show(ok ? 'Clave copiada' : 'No se pudo copiar la clave', ok ? 'success' : 'error');
  }

  async copyCodes(): Promise<void> {
    const ok = await copyText((this.recoveryCodes() ?? []).join('\n'));
    this.toast.show(ok ? 'Códigos copiados' : 'No se pudo copiar', ok ? 'success' : 'error');
  }

  downloadCodes(): void {
    downloadText('fusaroute-codigos-de-respaldo.txt', (this.recoveryCodes() ?? []).join('\n'));
  }

  /** El padre desmonta el componente al recibir `enrolled`, y con él se descartan los códigos. */
  finish(): void {
    this.enrolled.emit();
  }
}
