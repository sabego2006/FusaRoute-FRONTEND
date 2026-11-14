import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { RouteSearchComponent } from './pages/routes/route-search/route-search.component';

// El catalogo de rutas (listado y detalle) es publico, sin sesion (RF-15): no lleva authGuard.
export const routes: Routes = [
  { path: 'health', loadComponent: () => import('./pages/health-check/health-check.component').then(m => m.HealthCheckComponent) },
  {
    path: 'rutas',
    loadComponent: () => import('./pages/routes/routes-list/routes-list.component').then(m => m.RoutesListComponent),
  },
  // Import estatico (no loadComponent) a proposito: RNF-01/SCRUM-127 mide el LCP de
  // esta pantalla contra 2.5s, y con carga diferida el navegador tiene que terminar de
  // pedir y parsear el chunk de esta ruta ANTES de poder pintar el <h1> — un viaje de
  // red completo que, bajo Slow 4G simulado, por si solo ya corria por encima del
  // presupuesto (medido: ~3.9s). Empaquetarla en el bundle inicial se paga una sola vez
  // en el bundle (sigue muy por debajo del budget de Angular, ver angular.json) y evita
  // ese viaje de red extra en la pantalla que mas le importa a este RNF.
  { path: 'rutas/buscar', component: RouteSearchComponent },
  {
    path: 'rutas/:id',
    loadComponent: () => import('./pages/routes/routes-detail/routes-detail.component').then(m => m.RoutesDetailComponent),
  },
  { path: 'registro', loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent) },
  { path: 'login', loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent) },
  {
    path: 'perfil',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard],
  },
  // El historial vive en la cuenta (RF-07), asi que exige sesion. El guard no es
  // cortesia visual: el endpoint responde 401 sin token, y sin el guard la pantalla se
  // abriria solo para mostrar un error.
  {
    path: 'historial',
    loadComponent: () => import('./pages/history/history.component').then(m => m.HistoryComponent),
    canActivate: [authGuard],
  },
  // La caja de comentarios exige sesion (RF-08): cada comentario muestra el nombre de
  // quien lo escribio, y sin cuenta no hay nombre que mostrar.
  {
    path: 'comentarios',
    loadComponent: () => import('./pages/comments/comments.component').then(m => m.CommentsComponent),
    canActivate: [authGuard],
  },
  // Armazon de administracion (SCRUM-23). Los dos guards van en el padre y cubren a
  // todas las hijas: authGuard para el caso sin sesion y adminGuard para el de sesion
  // sin rol, que mandan a sitios distintos. Ninguno de los dos es seguridad: el backend
  // exige rol ADMIN en /api/admin/** y responde 403 (SCRUM-104). Ver adminGuard.
  //
  // Una seccion nueva (rutas, suspensiones, metricas) se agrega como hija ANTES del
  // comodin y se marca `available: true` en ADMIN_SECTIONS (admin-layout.component.ts).
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin-layout/admin-layout.component')
      .then(m => m.AdminLayoutComponent),
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'comentarios' },
      // Panel de comentarios (RF-14, SCRUM-103).
      {
        path: 'comentarios',
        loadComponent: () => import('./pages/admin/admin-comments/admin-comments.component')
          .then(m => m.AdminCommentsComponent),
      },
      // Gestion de rutas (RF-11, SCRUM-24). 'nueva' va antes que ':id/editar' para que el
      // comodin de id no se la coma.
      {
        path: 'rutas',
        loadComponent: () => import('./pages/admin/admin-routes/admin-routes.component')
          .then(m => m.AdminRoutesComponent),
      },
      {
        path: 'rutas/nueva',
        loadComponent: () => import('./pages/admin/admin-route-form/admin-route-form.component')
          .then(m => m.AdminRouteFormComponent),
      },
      {
        path: 'rutas/:id/editar',
        loadComponent: () => import('./pages/admin/admin-route-form/admin-route-form.component')
          .then(m => m.AdminRouteFormComponent),
      },
      // Suspensiones temporales de rutas (RF-12, SCRUM-25).
      {
        path: 'suspensiones',
        loadComponent: () => import('./pages/admin/admin-suspensions/admin-suspensions.component')
          .then(m => m.AdminSuspensionsComponent),
      },
      // Una seccion que aun no existe cae en comentarios y no en el comodin global,
      // que sacaria al administrador al catalogo publico sin explicacion.
      { path: '**', redirectTo: 'comentarios' },
    ],
  },
  // La raiz cae en el buscador y no en el listado (RNF-04): abrir la app ya cuenta
  // como la primera de las 4 acciones del flujo, asi que tiene que aterrizar donde
  // el usuario va a buscar, no en el catalogo.
  { path: '', redirectTo: 'rutas/buscar', pathMatch: 'full' },
  { path: '**', redirectTo: 'rutas' },
];
