import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { delay, of, throwError } from 'rxjs';
import { Place } from '../../models/place.model';
import { CongestionSector, RouteDetail, RouteSearchResult } from '../../models/route.model';

/**
 * Datos simulados del contrato de lugares (P1) mientras el backend no está en `main`.
 * SOLO se registra con `environment.mockApi = true` (configuración `mock` de ng serve,
 * usada por las pruebas de Playwright). Ningún build de producción lo incluye activo.
 *
 * Coordenadas reales sacadas de los KML de las rutas.
 */
export const MOCK_PLACES: Place[] = [
  { id: 12, slug: 'indio', name: 'Indio', lat: 4.331682, lng: -74.3775168, aliases: ['Monumento El Indio'], routeCount: 19 },
  { id: 21, slug: 'u-hospital-exito', name: 'U. Hospital Éxito', lat: 4.3333531, lng: -74.3709426, aliases: ['Hospital San Rafael', 'Éxito'], routeCount: 11 },
  { id: 30, slug: 'puente-aguila', name: 'Puente Águila', lat: 4.3391456, lng: -74.3637484, aliases: ['El Águila'], routeCount: 8 },
  { id: 33, slug: 'plaza-de-mercado', name: 'Plaza de Mercado', lat: 4.3418171, lng: -74.3650007, aliases: ['Galería'], routeCount: 14 },
  { id: 40, slug: 'terminal', name: 'Terminal de Transporte', lat: 4.3458867, lng: -74.3778591, aliases: ['Terminal'], routeCount: 22 },
  { id: 41, slug: 'clinica-belen', name: 'Clínica Belén', lat: 4.3401, lng: -74.3689, aliases: [], routeCount: 6 },
  { id: 42, slug: 'parque-principal', name: 'Parque Principal', lat: 4.3372, lng: -74.3640, aliases: ['Centro'], routeCount: 25 },
];

const ROUTE: RouteDetail = {
  id: 14,
  name: 'Centro - Galería - Terminal',
  signFile: 'CENTRO_GALERIA_TERMINAL',
  type: 'URBANA',
  neighborhoods: ['Indio', 'U. Hospital Éxito', 'Puente Águila', 'Plaza de Mercado', 'Terminal de Transporte'],
  fares: [{ referencePoint: null, amount: 2600, validFrom: '2026-02-05' }],
  path: {
    type: 'LineString',
    coordinates: [[-74.3775, 4.3317], [-74.3709, 4.3334], [-74.3637, 4.3391], [-74.3650, 4.3418], [-74.3779, 4.3459]],
  },
  congestionSectors: [],
  lastUpdatedAt: '2026-02-05',
};

const INDIO_TARDE: CongestionSector = { name: 'Indio (tarde)', startsAt: '17:00:00', endsAt: '19:00:00' };

/** Como el backend: el aviso se enciende 30 min antes de la franja (16:30–19:00). */
function congestionNow(): CongestionSector[] {
  const d = new Date();
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes >= 16 * 60 + 30 && minutes < 19 * 60 ? [INDIO_TARDE] : [];
}

function endFrom(req: HttpRequest<unknown>, prefix: 'origin' | 'destination') {
  const id = req.params.get(`${prefix}PlaceId`);
  if (id) {
    const p = MOCK_PLACES.find((x) => x.id === Number(id));
    return p ? { lat: p.lat, lng: p.lng, label: p.name } : null;
  }
  const lat = req.params.get(`${prefix}Lat`);
  const lng = req.params.get(`${prefix}Lng`);
  return lat && lng ? { lat: Number(lat), lng: Number(lng), label: prefix === 'origin' ? 'Su punto de salida' : 'Su punto de llegada' } : null;
}

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  // Solo la ruta: se quita el origen (cualquiera que sea apiUrl) y la query.
  const path = req.url.replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0];
  const ok = <T>(body: T) => of(new HttpResponse({ status: 200, body })).pipe(delay(150));

  if (path === '/api/places') return ok(MOCK_PLACES);
  if (path === '/api/routes') return ok([ROUTE]);
  if (/^\/api\/routes\/\d+$/.test(path)) return ok({ ...ROUTE, congestionSectors: congestionNow() });

  if (path === '/api/routes/search' || path === '/api/routes/search/offline') {
    const offline = path.endsWith('offline');
    const origin = endFrom(req, 'origin');
    const destination = endFrom(req, 'destination');
    if (!origin || !destination) {
      return throwError(() => new HttpErrorResponse({ status: 400, error: { status: 400, detail: 'Falta origen o destino.' } }));
    }
    if (origin.label === destination.label) {
      return throwError(() => new HttpErrorResponse({
        status: 404,
        error: {
          status: 404,
          detail: 'No hay rutas que conecten ese origen con ese destino.',
          nearestRoutes: { origin: { routeName: ROUTE.name, distanceInMeters: 420 }, destination: null },
        },
      })).pipe(delay(150));
    }
    const body: RouteSearchResult = {
      route: ROUTE,
      estimatedMinutes: offline ? null : 18,
      etaSource: offline ? null : 'TRAFFIC',
      travelDistanceInMeters: 6115,
      boarding: { latitude: 4.3317, longitude: -74.3775, distanceInMeters: 312, walkingMinutes: 4 },
      dropOff: { latitude: 4.3459, longitude: -74.3779, distanceInMeters: 95, walkingMinutes: 1 },
      longWalk: false,
      congestionSectors: congestionNow(),
      origin,
      destination,
      path: ROUTE.path,
      lastUpdatedAt: ROUTE.lastUpdatedAt,
    };
    return ok(body);
  }
  return next(req);
};
