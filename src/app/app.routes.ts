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
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/registrar-atraso',
        loadComponent: () => import('./pages/secretaria/registrar-atraso/registrar-atraso').then(m => m.RegistrarAtraso),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/registrar-saida',
        loadComponent: () => import('./pages/secretaria/registrar-saida/registrar-saida').then(m => m.RegistrarSaida),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/relatorio-dia',
        loadComponent: () => import('./pages/secretaria/relatorio-dia/relatorio-dia').then(m => m.RelatorioDia),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/lista-controles',
        loadComponent: () => import('./pages/secretaria/lista-controles/lista-controles').then(m => m.ListaControles),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/gerenciar-alunos',
        loadComponent: () => import('./pages/secretaria/gerenciar-alunos/gerenciar-alunos').then(m => m.GerenciarAlunos),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/registrar-faltas',
        loadComponent: () => import('./pages/secretaria/registrar-faltas/registrar-faltas').then(m => m.RegistrarFaltas),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/relatorio-faltas',
        loadComponent: () => import('./pages/secretaria/relatorio-faltas/relatorio-faltas').then(m => m.RelatorioFaltas),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/registrar-falta-professor',
        loadComponent: () => import('./pages/secretaria/registrar-falta-professor/registrar-falta-professor').then(m => m.RegistrarFaltaProfessor),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/lista-faltas-professores',
        loadComponent: () => import('./pages/secretaria/lista-faltas-professores/lista-faltas-professores').then(m => m.ListaFaltasProfessores),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/ficha100-professor',
        loadComponent: () => import('./pages/secretaria/ficha100-professor/ficha100-professor').then(m => m.Ficha100Professor),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'secretaria/gerenciar-professores',
        loadComponent: () => import('./pages/secretaria/gerenciar-professores/gerenciar-professores').then(m => m.GerenciarProfessores),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['secretaria', 'direcao'] }
    },
    {
        path: 'agendamento-equipamentos',
        loadComponent: () => import('./pages/agendamento-equipamentos/agendamento-equipamentos').then(m => m.AgendamentoEquipamentosComponent),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['professor', 'coordenacao', 'direcao'] }
    },
    {
        path: 'coordenacao/painel-frequencia',
        loadComponent: () => import('./pages/coordenacao/painel-frequencia/painel-frequencia').then(m => m.PainelFrequencia),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['coordenacao', 'direcao'] }
    },
    {
        path: 'coordenacao/estatisticas-ocorrencias',
        loadComponent: () => import('./pages/coordenacao/estatisticas-ocorrencias/estatisticas-ocorrencias').then(m => m.EstatisticasOcorrencias),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['coordenacao', 'direcao'] }
    },
    {
        path: 'coordenacao/ficha-aluno',
        loadComponent: () => import('./pages/coordenacao/ficha-aluno/ficha-aluno').then(m => m.FichaAluno),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['coordenacao', 'direcao'] }
    },
    {
        path: 'coordenacao/painel-busca-ativa',
        loadComponent: () => import('./pages/coordenacao/painel-busca-ativa/painel-busca-ativa').then(m => m.PainelBuscaAtiva),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['coordenacao', 'direcao'] }
    },
    {
        path: 'professor/diario',
        loadComponent: () => import('./pages/professor/diario-classe/diario-classe').then(m => m.DiarioClasse),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['professor', 'coordenacao', 'direcao'] }
    },
    {
        path: 'professor/lousa',
        loadComponent: () => import('./pages/professor/lousa/lousa').then(m => m.Lousa),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['professor', 'coordenacao', 'direcao'] }
    },
    {
        // Rota pública para projeção — sem autenticação
        path: 'projetar',
        loadComponent: () => import('./pages/professor/lousa/lousa').then(m => m.Lousa),
        data: { projetor: true }
    },
    {
        path: '**',
        redirectTo: 'login'
    }
];
