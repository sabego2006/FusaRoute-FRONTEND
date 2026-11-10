import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { PlaceComboboxComponent, ComboboxAction } from './place-combobox.component';
import { MOCK_PLACES } from '../../core/mock/mock-api.interceptor';

describe('PlaceComboboxComponent', () => {
  let fixture: ComponentFixture<PlaceComboboxComponent>;
  let input: HTMLInputElement;
  let actions: ComboboxAction[];

  const host = () => fixture.nativeElement as HTMLElement;
  const options = () => Array.from(host().querySelectorAll<HTMLLIElement>('[role="option"]')).map((o) => o.textContent!.trim());
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const key = (k: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  async function setup(offerMyLocation: boolean) {
    await TestBed.configureTestingModule({ imports: [PlaceComboboxComponent] }).compileComponents();
    fixture = TestBed.createComponent(PlaceComboboxComponent);
    fixture.componentRef.setInput('label', 'Origen');
    fixture.componentRef.setInput('places', MOCK_PLACES);
    fixture.componentRef.setInput('offerMyLocation', offerMyLocation);
    actions = [];
    fixture.componentInstance.action.subscribe((a) => actions.push(a));
    fixture.detectChanges();
    input = host().querySelector('input')!;
  }

  describe('origen', () => {
    beforeEach(() => setup(true));

    it('expone el patrón combobox de ARIA con su etiqueta', () => {
      expect(input.getAttribute('role')).toBe('combobox');
      expect(input.getAttribute('aria-autocomplete')).toBe('list');
      expect(host().querySelector(`label[for="${input.id}"]`)?.textContent).toContain('Origen');
      expect(input.getAttribute('aria-controls')).toBe(host().querySelector('[role="listbox"]')!.id);
    });

    it('al enfocar muestra Mi ubicación primero y Elegir en el mapa', () => {
      input.dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      expect(input.getAttribute('aria-expanded')).toBe('true');
      expect(options()).toEqual(['📍 Mi ubicación', '🗺️ Elegir en el mapa']);
    });

    it('sugiere sin importar tildes y por alias, después de las acciones', () => {
      type('MONUMENTO');
      expect(options().slice(2)[0]).toContain('Indio');
      expect(options()[2]).toContain('Monumento El Indio');
      type('aguila');
      expect(options().slice(2).some((o) => o.includes('Puente Águila'))).toBe(true);
    });

    it('ordena empieza con antes que contiene', () => {
      type('ter');
      expect(options()[2]).toContain('Terminal de Transporte');
    });

    it('Enter elige la sugerencia activa sin enviar el formulario', () => {
      type('ind');
      const ev = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      input.dispatchEvent(ev);
      fixture.detectChanges();
      expect(ev.defaultPrevented).toBe(true);
      const v = fixture.componentInstance.value();
      expect(v?.kind === 'place' && v.place.id).toBe(12);
      expect(input.value).toBe('Indio');
      expect(input.getAttribute('aria-expanded')).toBe('false');
    });

    it('flechas recorren las opciones y marcan aria-activedescendant', () => {
      type('ind');
      key('ArrowUp'); // de Indio a "Elegir en el mapa"
      expect(input.getAttribute('aria-activedescendant')).toContain('-mapa');
      key('ArrowUp');
      expect(input.getAttribute('aria-activedescendant')).toContain('-gps');
      key('Enter');
      expect(actions).toEqual(['my-location']);
    });

    it('Escape cierra la lista y, con la lista cerrada, borra el texto', () => {
      type('ind');
      key('Escape');
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(input.value).toBe('ind');
      key('Escape');
      expect(input.value).toBe('');
    });

    it('elegir en el mapa avisa a la pantalla', () => {
      input.dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      host().querySelectorAll<HTMLLIElement>('[role="option"]')[1].click();
      expect(actions).toEqual(['map']);
    });

    it('escribir el nombre completo y salir del campo lo elige', () => {
      type('terminal');
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      expect(fixture.componentInstance.value()?.label).toBe('Terminal de Transporte');
    });

    it('editar el texto de algo elegido lo deselecciona', () => {
      type('ind');
      key('Enter');
      type('Indi');
      expect(fixture.componentInstance.value()).toBeNull();
    });

    it('avisa cuando no hay coincidencias', () => {
      type('zzzzzz');
      expect(host().textContent).toContain('No encontramos');
    });
  });

  it('el destino no ofrece Mi ubicación', async () => {
    await setup(false);
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(options()).toEqual(['🗺️ Elegir en el mapa']);
  });
});
