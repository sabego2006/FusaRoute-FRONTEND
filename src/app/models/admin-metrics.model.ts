/** Una fila del ranking de rutas más consultadas (métrica 3 de RF-13). */
export interface TopRoute {
  routeId: number;
  routeName: string;
  searches: number;
}

/**
 * Espeja AdminMetricsResponse del backend (`GET /api/admin/metrics`, RF-13).
 *
 * Son exactamente cinco métricas (usuarios, búsquedas de hoy, ranking, comentarios
 * pendientes y suspensiones activas) más tres campos de metadatos.
 */
export interface AdminMetrics {
  totalUsers: number;
  /** Día calendario actual en `America/Bogota`. */
  searchesToday: number;
  /** Máximo 5 y ya ordenadas por el backend. */
  topRoutes: TopRoute[];
  pendingComments: number;
  activeSuspensions: number;
  /** ISO-8601 con offset. */
  generatedAt: string;
  timezone: string;
  /** El ranking cubre los últimos N días, no un acumulado histórico. */
  topRoutesWindowDays: number;
}
