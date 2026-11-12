import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Una entrada de la navegación de administración. */
export interface AdminSection {
  label: string;
  /** Ruta hija relativa a `/admin`. */
  path: string;
  /** `false` mientras la pantalla no exista: se pinta deshabilitada con "Próximamente". */
  available: boolean;
}

/**
 * Secciones de administración, en el orden en que se muestran.
 *
 * Para activar una sección nueva (gestión de rutas, suspensiones, métricas) hacen
 * falta dos cambios y nada más: poner aquí `available: true` y agregar su ruta hija
 * bajo `admin` en `app.routes.ts`. La etiqueta "Próximamente" desaparece sola.
 */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { label: 'Comentarios', path: 'comentarios', available: true },
  { label: 'Rutas', path: 'rutas', available: true },
  { label: 'Suspensiones', path: 'suspensiones', available: false },
  { label: 'Métricas', path: 'metricas', available: false },
];

/**
 * Armazón de administración (SCRUM-23): navegación entre secciones y un
 * `<router-outlet>` donde cuelga cada pantalla como ruta hija de `/admin`.
 *
 * La ruta padre lleva `authGuard` y `adminGuard`, así que ninguna hija necesita
 * repetirlos. Igual que en el resto de la app, **eso no es seguridad**: lo que protege
 * los datos es el backend, que exige rol ADMIN en `/api/admin/**`.
 *
 * Una sección que todavía no existe se pinta como texto con `aria-disabled` y no como
 * enlace: un enlace que no lleva a ninguna parte recibiría el foco del teclado para
 * nada, y el lector de pantalla lo anunciaría como algo que se puede abrir.
 *
 * En pantalla ancha la navegación va al lado; en pantalla angosta pasa a una fila de
 * pestañas con desplazamiento horizontal propio, para que cuatro entradas no
 * desborden la página a 320 px.
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="fr-admin">
      <nav class="fr-admin__nav" aria-label="Secciones de administración">
        <p class="fr-admin__titulo">Administración</p>
        <ul class="fr-admin__lista">
          @for (section of sections; track section.path) {
            <li>
              @if (section.available) {
                <a class="fr-admin__item"
                   [routerLink]="section.path"
                   routerLinkActive="is-activa"
                   ariaCurrentWhenActive="page">{{ section.label }}</a>
              } @else {
                <span class="fr-admin__item fr-admin__item--deshabilitada" aria-disabled="true">
                  {{ section.label }}
                  <span class="fr-admin__pronto">Próximamente</span>
                </span>
              }
            </li>
          }
        </ul>
      </nav>

      <div class="fr-admin__contenido">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    .fr-admin {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .fr-admin__titulo {
      margin: 0 0 var(--space-2);
      font: 700 0.8rem/1 var(--font-display);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--tinta-suave);
    }
    /*
     * El desplazamiento horizontal es de la lista, no de la página: a 320 px las
     * cuatro pestañas no caben y así se deslizan sin mover el resto de la pantalla.
     * El relleno deja sitio al contorno de foco, que 'overflow' recortaría.
     */
    .fr-admin__lista {
      list-style: none;
      margin: 0;
      padding: var(--space-1);
      display: flex;
      gap: var(--space-2);
      overflow-x: auto;
    }
    .fr-admin__lista li { flex: none; }
    .fr-admin__item {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 44px;
      padding: 0 var(--space-3);
      border: var(--trazo-2) solid var(--borde);
      border-radius: var(--radius-md);
      background: var(--superficie);
      color: var(--tinta);
      font: 600 0.95rem/1.2 var(--font-sans);
      text-decoration: none;
      white-space: nowrap;
    }
    a.fr-admin__item:hover { background: var(--indigo-suave); }
    a.fr-admin__item:focus-visible { outline: 3px solid var(--foco); outline-offset: 2px; }
    .fr-admin__item.is-activa {
      background: var(--indigo-accion);
      color: var(--sobre-indigo);
    }
    .fr-admin__item.is-activa:hover { background: var(--indigo-accion); }
    .fr-admin__item--deshabilitada {
      border-style: dashed;
      border-color: var(--tinta-suave);
      background: var(--fondo);
      color: var(--tinta-suave);
      cursor: not-allowed;
    }
    .fr-admin__pronto {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px var(--space-2);
      border: var(--trazo-1) solid var(--tinta-suave);
      border-radius: var(--radius-full);
    }
    .fr-admin__contenido { min-width: 0; }

    @media (min-width: 900px) {
      .fr-admin {
        flex-direction: row;
        align-items: flex-start;
        gap: var(--space-6);
      }
      .fr-admin__nav {
        flex: none;
        width: 240px;
        position: sticky;
        top: var(--space-4);
        margin-top: 2rem;
      }
      .fr-admin__lista {
        flex-direction: column;
        overflow-x: visible;
      }
      .fr-admin__item { justify-content: space-between; }
      .fr-admin__contenido { flex: 1; }
    }
  `],
})
export class AdminLayoutComponent {
  protected readonly sections = ADMIN_SECTIONS;
}
