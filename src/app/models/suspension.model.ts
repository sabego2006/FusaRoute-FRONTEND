/** Estado de una suspensión, calculado por el backend con su propio reloj. */
export type SuspensionState = 'ACTIVE' | 'UPCOMING' | 'ENDED' | 'LIFTED';

/** Filtro de `GET /api/admin/suspensions?state=`. */
export type SuspensionFilter = 'active' | 'upcoming' | 'past' | 'all';

/** Espeja SuspensionResponse del backend (RF-12). Los instantes vienen en UTC con `Z`. */
export interface Suspension {
  id: number;
  routeId: number;
  routeName: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  liftedAt: string | null;
  state: SuspensionState;
}

/** Cuerpo de `POST /api/admin/routes/{id}/suspensions`. Ambos instantes con offset. */
export interface SuspensionRequest {
  startsAt: string;
  endsAt: string;
  reason?: string;
}

export const SUSPENSION_REASON_MAX = 200;

/** Ruta candidata suspendida en el 404 de "sin ruta" de la búsqueda. */
export interface SuspendedCandidate {
  routeId: number;
  routeName: string;
  endsAt: string;
}
