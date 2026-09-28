import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'health', loadComponent: () => import('./pages/health-check/health-check.component').then(m => m.HealthCheckComponent) },
  {
    path: 'rutas',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/routes/routes-list/routes-list.component').then(m => m.RoutesListComponent)
  },
  {
    path: 'rutas/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/routes/routes-detail/routes-detail.component').then(m => m.RoutesDetailComponent)
  },
  { path: 'registro', loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent) },
  { path: 'login', loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent) },
  { path: '', redirectTo: 'rutas', pathMatch: 'full' }
];
