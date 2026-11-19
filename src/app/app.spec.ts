import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from './app';
import { NavigationFailureStore } from './core/navigation-failure.store';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // T15 (SCRUM-199): una pantalla diferida cuyo chunk no bajó dejaba la vista en blanco.
  it('si una pantalla no se pudo cargar, lo dice y ofrece volver a cargar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')).toBeNull();

    TestBed.inject(NavigationFailureStore).fail('/rutas');
    fixture.detectChanges();

    // Con red, el fallo del chunk sí es un error; sin red sería una espera (ver app.html).
    const alerta = el.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('no alcanzó a cargar');
    const boton = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar'));
    expect(boton, 'tiene que haber una salida, no solo el aviso').toBeDefined();
  });

  it('volver a cargar apunta a la pantalla que falló y limpia el aviso', () => {
    const fixture = TestBed.createComponent(App);
    const original = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...original, pathname: original.pathname, assign },
      configurable: true,
      writable: true,
    });
    fixture.detectChanges();

    TestBed.inject(NavigationFailureStore).fail('/rutas');
    fixture.componentInstance.reload();

    expect(assign).toHaveBeenCalledWith('/rutas');
    expect(TestBed.inject(NavigationFailureStore).failedUrl()).toBeNull();
    Object.defineProperty(window, 'location', { value: original, configurable: true, writable: true });
  });
});
