import { describe, expect, it } from 'vitest';
import { municipalityOf } from './municipality';

describe('municipalityOf', () => {
  it('toda ruta urbana es de Fusagasugá', () => {
    expect(municipalityOf('Centro - Galería - Terminal', 'URBANA')).toEqual({ slug: 'fusagasuga', name: 'Fusagasugá' });
  });

  it('reconoce el municipio por el nombre de la ruta intermunicipal, con o sin tilde', () => {
    expect(municipalityOf('Pasca', 'INTERMUNICIPAL').slug).toBe('pasca');
    expect(municipalityOf('Arbelaez', 'INTERMUNICIPAL').name).toBe('Arbeláez');
    expect(municipalityOf('Fusagasugá - San Bernardo', 'INTERMUNICIPAL').slug).toBe('san-bernardo');
  });

  it('Chinauta es un corregimiento de Fusa: mismo color, otro nombre', () => {
    expect(municipalityOf('Chinauta - Fusa Centro', 'INTERMUNICIPAL')).toEqual({ slug: 'fusagasuga', name: 'Chinauta' });
  });

  it('sin municipio reconocible dice Sumapaz, no inventa uno', () => {
    expect(municipalityOf('Cuja - Horizonte - Mesitas', 'INTERMUNICIPAL')).toEqual({ slug: 'fusagasuga', name: 'Sumapaz' });
  });
});
