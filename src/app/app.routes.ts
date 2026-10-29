import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
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
  { path: '', redirectTo: 'rutas', pathMatch: 'full' },
  { path: '**', redirectTo: 'rutas' },
];
