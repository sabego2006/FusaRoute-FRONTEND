import { GeoJsonLineString } from '../models/route.model';
import { LatLngPoint } from '../components/map-view/map-view.component';

/**
 * Primer y último vértice de un LineString GeoJSON como puntos de Google Maps.
 * Son los marcadores de inicio y fin del recorrido cuando el resultado de la búsqueda
 * (o el detalle) no viene con `boarding`/`dropOff` — p. ej. una ruta sin última milla
 * calculada o una respuesta online que degradó al modo offline.
 *
 * Devuelve `null` si el trazado no viene o viene vacío, para que la vista pueda
 * decidir con un único @if si pinta el mapa o el aviso de "aún no tiene recorrido".
 *
 * Ojo: GeoJSON guarda **[longitud, latitud]**, y Google Maps espera `{lat, lng}` —
 * mismo cruce que hace `GeoJsonLineStringResponse` del backend en sentido contrario.
 */
export function linestringEnds(path: GeoJsonLineString | null | undefined): {
  start: LatLngPoint;
  end: LatLngPoint;
} | null {
  if (!path?.coordinates.length) return null;
  const toPoint = ([lng, lat]: [number, number]): LatLngPoint => ({ lat, lng });
  return {
    start: toPoint(path.coordinates[0]),
    end: toPoint(path.coordinates[path.coordinates.length - 1]),
  };
}
