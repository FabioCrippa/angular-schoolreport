import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { RegistroOcorrencia } from './pages/registro-ocorrencia/registro-ocorrencia';
import { ListaOcorrencias } from './pages/lista-ocorrencias/lista-ocorrencias';

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
        path: '**',
        redirectTo: 'login'
    }
];
