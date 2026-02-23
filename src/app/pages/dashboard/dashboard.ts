import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../services/auth';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FirestoreService, Ocorrencia } from '../../services/firestore';
import { RelatoriosService, EstatisticasGerais } from '../../services/relatorios.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  private authService = inject(AuthService);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  private relatoriosService = inject(RelatoriosService);
  private cdr = inject(ChangeDetectorRef);

  userName = '';
  userEmail = '';
  isAdmin = false;
  userRole: 'professor' | 'coordenacao' | 'direcao' | 'secretaria' | null = null;
  loading = true;
  loadingEstatisticas = false;

  // Estatísticas
  estatisticas: EstatisticasGerais | null = null;

  // Dados dos gráficos
  // Gráfico de linha - Ocorrências por mês
  lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Ocorrências',
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };
  lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      title: {
        display: true,
        text: 'Tendência de Ocorrências (Últimos 6 Meses)'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  // Gráfico de barras - Top turmas
  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Ocorrências',
        backgroundColor: '#8b5cf6'
      }
    ]
  };
  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Top 10 Turmas com Mais Ocorrências'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  // Lista de emails de administradores
  private ADMIN_EMAILS = ['admin@escola.com'];

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.displayName || 'Professor';
      this.userEmail = user.email || '';
      
      // Verifica se o usuário é admin
      this.isAdmin = this.ADMIN_EMAILS.includes(user.email || '');
      
      // Busca o role do usuário
      this.carregarDadosUsuario();
    } else {
      this.loading = false;
    }
  }
  
  async carregarDadosUsuario() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.loading = false;
        return;
      }
      
      // Buscar dados do usuário no Firestore para pegar o role
      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      if (usuario) {
        this.userRole = usuario.role;
        this.userName = usuario.nome || this.userName;
        console.log('Role do usuário:', this.userRole);
        
        // Redirecionar secretaria para dashboard próprio
        if (this.userRole === 'secretaria') {
          this.router.navigate(['/secretaria/dashboard']);
          return;
        }

        // Carregar estatísticas para coordenação e direção
        if (this.userRole === 'coordenacao' || this.userRole === 'direcao') {
          await this.carregarEstatisticas();
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
      console.log('Dashboard loading finalizado:', this.loading, 'Role:', this.userRole);
    }
  }

  async carregarEstatisticas() {
    try {
      this.loadingEstatisticas = true;
      
      // Buscar todas as ocorrências da escola do usuário
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      if (!usuario || !usuario.escolaId) return;

      // Buscar ocorrências
      const ocorrencias = await this.firestoreService.buscarOcorrencias(usuario.escolaId);
      
      // Calcular estatísticas
      this.estatisticas = this.relatoriosService.calcularEstatisticasOcorrencias(ocorrencias);
      
      // Preparar dados dos gráficos
      this.prepararDadosGraficos();
      
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      this.loadingEstatisticas = false;
      this.cdr.detectChanges();
    }
  }

  prepararDadosGraficos() {
    if (!this.estatisticas) return;

    // Gráfico de linha - Ocorrências por mês
    this.lineChartData = {
      labels: this.estatisticas.ocorrenciasPorMes.map(item => item.mes),
      datasets: [
        {
          data: this.estatisticas.ocorrenciasPorMes.map(item => item.quantidade),
          label: 'Ocorrências',
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };

    // Gráfico de barras - Top turmas
    this.barChartData = {
      labels: this.estatisticas.ocorrenciasPorTurma.map(item => item.turma),
      datasets: [
        {
          data: this.estatisticas.ocorrenciasPorTurma.map(item => item.quantidade),
          label: 'Ocorrências',
          backgroundColor: '#8b5cf6'
        }
      ]
    };
  }

  exportarCSV() {
    if (!this.estatisticas) return;
    
    this.firestoreService.buscarUsuario(this.authService.getCurrentUser()!.uid)
      .then(usuario => {
        if (usuario?.escolaId) {
          this.firestoreService.buscarOcorrencias(usuario.escolaId)
            .then((ocorrencias: Ocorrencia[]) => {
              this.relatoriosService.exportarParaCSV(
                ocorrencias, 
                `relatorio-ocorrencias-${new Date().toISOString().split('T')[0]}.csv`
              );
            });
        }
      });
  }

  logout() {
    this.authService.logout();
  }

  goToRegistro() {
    this.router.navigate(['/registro']);
  }

  goToOcorrencias() {
    this.router.navigate(['/ocorrencias']);
  }
}
