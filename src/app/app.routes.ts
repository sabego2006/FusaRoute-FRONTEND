import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

// El catalogo de rutas (listado y detalle) es publico, sin sesion (RF-15): no lleva authGuard.
export const routes: Routes = [
  { path: 'health', loadComponent: () => import('./pages/health-check/health-check.component').then(m => m.HealthCheckComponent) },
  {
    path: 'rutas',
    loadComponent: () => import('./pages/routes/routes-list/routes-list.component').then(m => m.RoutesListComponent),
  },
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
