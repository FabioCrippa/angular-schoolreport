import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { RegistroOcorrencia } from './pages/registro-ocorrencia/registro-ocorrencia';
import { ListaOcorrencias } from './pages/lista-ocorrencias/lista-ocorrencias';
import { Admin } from './pages/admin/admin';
import { PrimeiroAcesso } from './pages/primeiro-acesso/primeiro-acesso';
import { DashboardSecretaria } from './pages/secretaria/dashboard-secretaria/dashboard-secretaria';
import { RegistrarAtraso } from './pages/secretaria/registrar-atraso/registrar-atraso';
import { RegistrarSaida } from './pages/secretaria/registrar-saida/registrar-saida';
import { RelatorioDia } from './pages/secretaria/relatorio-dia/relatorio-dia';

export const routes: Routes = [
    {
        path: '',
        component: Home
    },
    {
        path: 'login',
        component: Login
    },
    {
        path: 'dashboard',
        component: Dashboard
    },
    {
        path: 'registro',
        component: RegistroOcorrencia
    },
    {
        path: 'ocorrencias',
        component: ListaOcorrencias
    },
    {
        path: 'admin',
        component: Admin
    },
    {
        path: 'primeiro-acesso',
        component: PrimeiroAcesso
    },
    {
        path: 'secretaria/dashboard',
        component: DashboardSecretaria
    },
    {
        path: 'secretaria/registrar-atraso',
        component: RegistrarAtraso
    },
    {
        path: 'secretaria/registrar-saida',
        component: RegistrarSaida
    },
    {
        path: 'secretaria/relatorio-dia',
        component: RelatorioDia
    },
    {
        path: '**',
        redirectTo: 'login'
    }
];
