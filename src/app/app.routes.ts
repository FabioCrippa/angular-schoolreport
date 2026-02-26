import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./pages/home/home').then(m => m.Home)
    },
    {
        path: 'login',
        loadComponent: () => import('./pages/login/login').then(m => m.Login)
    },
    {
        path: 'primeiro-acesso',
        loadComponent: () => import('./pages/primeiro-acesso/primeiro-acesso').then(m => m.PrimeiroAcesso)
    },
    {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
        canActivate: [authGuard]
    },
    {
        path: 'registro',
        loadComponent: () => import('./pages/registro-ocorrencia/registro-ocorrencia').then(m => m.RegistroOcorrencia),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['professor', 'coordenacao', 'direcao'] }
    },
    {
        path: 'ocorrencias',
        loadComponent: () => import('./pages/lista-ocorrencias/lista-ocorrencias').then(m => m.ListaOcorrencias),
        canActivate: [authGuard]
    },
    {
        path: 'admin',
        loadComponent: () => import('./pages/admin/admin').then(m => m.Admin),
        canActivate: [authGuard, adminGuard]
    },
    {
        path: 'secretaria/dashboard',
        loadComponent: () => import('./pages/secretaria/dashboard-secretaria/dashboard-secretaria').then(m => m.DashboardSecretaria),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria'] }
    },
    {
        path: 'secretaria/registrar-atraso',
        loadComponent: () => import('./pages/secretaria/registrar-atraso/registrar-atraso').then(m => m.RegistrarAtraso),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria'] }
    },
    {
        path: 'secretaria/registrar-saida',
        loadComponent: () => import('./pages/secretaria/registrar-saida/registrar-saida').then(m => m.RegistrarSaida),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria'] }
    },
    {
        path: 'secretaria/relatorio-dia',
        loadComponent: () => import('./pages/secretaria/relatorio-dia/relatorio-dia').then(m => m.RelatorioDia),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria'] }
    },
    {
        path: 'secretaria/lista-controles',
        loadComponent: () => import('./pages/secretaria/lista-controles/lista-controles').then(m => m.ListaControles),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria'] }
    },
    {
        path: '**',
        redirectTo: 'login'
    }
];
