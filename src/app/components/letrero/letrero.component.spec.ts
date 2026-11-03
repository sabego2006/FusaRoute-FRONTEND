import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { LetreroComponent } from './letrero.component';

async function render(signFile: string | null | undefined, routeName = 'Centro - Galería - Terminal'): Promise<HTMLElement> {
  await TestBed.configureTestingModule({ imports: [LetreroComponent] }).compileComponents();
  const fixture = TestBed.createComponent(LetreroComponent);
  fixture.componentRef.setInput('signFile', signFile);
  fixture.componentRef.setInput('routeName', routeName);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('LetreroComponent', () => {
  it('con letrero, pinta el SVG de esa ruta', async () => {
    const el = await render('CENTRO_GALERIA_TERMINAL');
    const img = el.querySelector('img');

    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('letreros/CENTRO_GALERIA_TERMINAL.svg');
  });

  it('el texto alternativo nombra la ruta, no el archivo', async () => {
    // Quien usa lector de pantalla necesita saber de qué ruta es el letrero; el nombre
    // del archivo en MAYÚSCULAS con guiones bajos no se lee.
    const el = await render('CHINAUTA_BOQUERON', 'Chinauta - Boquerón');

    expect(el.querySelector('img')?.getAttribute('alt')).toBe('Letrero de la ruta Chinauta - Boquerón');
  });

  it('sin letrero no pinta nada: ni un hueco ni un letrero inventado', async () => {
    // Tres rutas del catálogo no tienen letrero fotografiado.
    const el = await render(null);

    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent?.trim()).toBe('');
  });

  it('si el backend no manda la clave signFile (build anterior), tampoco pinta nada', async () => {
    // El frontend se mergea antes que el backend: durante esa ventana la respuesta no
    // trae la clave, y eso tiene que significar "sin letrero", no una pantalla rota.
    const el = await render(undefined);

    expect(el.querySelector('img')).toBeNull();
  });

  it('el SVG se carga en diferido y no desborda su contenedor', async () => {
    // El letrero más ancho tiene 620 px de viewBox; a 375 px la clase .letrero lo
    // encoge con max-width en vez de sacar scroll horizontal.
    const el = await render('ARBELAEZ', 'Arbeláez');
    const img = el.querySelector('img');

    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.classList.contains('letrero')).toBe(true);
  });
});
