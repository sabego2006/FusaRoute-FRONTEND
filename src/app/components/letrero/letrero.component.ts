import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Letrero de una ruta (SCRUM-184): la placa que el pasajero ve en el parabrisas de la
 * buseta, para que pueda reconocerla. Es el SVG que se dibujó encima de la foto de
 * campo, con la misma forma, los mismos colores y la fuente libre más parecida.
 *
 * Antes (SCRUM-176) el letrero se armaba en vivo aquí, con tres plantillas fijas y los
 * colores que mandaba el backend. No se parecía a la foto, y eso fue justo lo que el
 * docente señaló. Ahora el backend manda un solo nombre de archivo y esta pieza lo
 * resuelve a `public/letreros/<signFile>.svg`.
 *
 * Una ruta = un letrero = un sentido: por eso es un archivo y no una lista.
 *
 * Misma pieza en el catálogo, en el detalle de la ruta y en el resultado de búsqueda.
 * Si la ruta no tiene letrero fotografiado (las tres del catálogo que no se pudieron
 * documentar), no pinta nada: ni un hueco ni un letrero inventado.
 */
@Component({
  selector: 'app-letrero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './letrero.component.html',
})
export class LetreroComponent {
  /** Nombre del archivo sin extensión, en MAYÚSCULAS con guion bajo. */
  readonly signFile = input<string | null | undefined>(null);

  /** Nombre legible de la ruta, solo para el texto alternativo. */
  readonly routeName = input.required<string>();

  readonly src = computed(() => `letreros/${this.signFile()}.svg`);

  readonly alt = computed(() => `Letrero de la ruta ${this.routeName()}`);
}
