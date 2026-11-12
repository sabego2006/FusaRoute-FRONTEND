import { GeoJsonLineString, RouteType } from './route.model';

/** Estado de una ruta tal como lo ve el administrador (RF-11/RF-12). */
export type AdminRouteStatus = 'ACTIVA' | 'SUSPENDIDA' | 'INACTIVA';

/** Espeja AdminRouteSummary del backend (`GET /api/admin/routes`). */
export interface AdminRouteSummary {
  id: number;
  name: string;
  type: RouteType;
  status: AdminRouteStatus;
  hasPath: boolean;
  neighborhoodsCount: number;
  /** `null` si la ruta no tiene ninguna tarifa vigente. */
  currentFare: number | null;
  /** ISO-8601. */
  updatedAt: string;
}

/** Tarifa de una ruta en el detalle de administración. `validFrom` es "YYYY-MM-DD". */
export interface AdminFare {
  amount: number;
  /** `null` en la tarifa única de una ruta urbana. */
  referencePoint: string | null;
  validFrom: string;
}

/** Espeja AdminRouteDetail del backend: el resumen más lo que hace falta para editar. */
export interface AdminRouteDetail extends AdminRouteSummary {
  pathGeoJson: GeoJsonLineString | null;
  /** En el orden en que la ruta los recorre. */
  neighborhoods: string[];
  fares: AdminFare[];
  signFile: string | null;
}

/** Una tarifa dentro del cuerpo de POST/PUT. La fecha de vigencia la pone el backend. */
export interface AdminFareInput {
  amount: number;
  referencePoint?: string;
}

/** Cuerpo de `POST /api/admin/routes` y `PUT /api/admin/routes/{id}`. */
export interface AdminRouteRequest {
  name: string;
  type: RouteType;
  pathGeoJson?: GeoJsonLineString;
  neighborhoods: string[];
  fares: AdminFareInput[];
  signFile?: string;
}

/** Límites que el backend valida; el formulario los anticipa pero el backend manda. */
export const ROUTE_NAME_MIN = 3;
export const ROUTE_NAME_MAX = 140;
export const ROUTE_NEIGHBORHOODS_MAX = 40;
