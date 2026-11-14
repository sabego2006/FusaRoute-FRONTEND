/** Por qué se le avisa al usuario: la ruta es su destino favorito o la usa seguido. */
export type NotificationReason = 'FAVORITE' | 'FREQUENT';

/** Espeja UserNotification del backend (`GET /api/users/me/notifications`). */
export interface UserNotification {
  type: 'ROUTE_SUSPENDED';
  suspensionId: number;
  routeId: number;
  routeName: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  because: NotificationReason;
}
