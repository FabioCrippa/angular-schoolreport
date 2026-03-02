import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { AuthService } from '../../services/auth';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirestoreService, Ocorrencia } from '../../services/firestore';
import { RelatoriosService, EstatisticasGerais } from '../../services/relatorios.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule, BaseChartDirective, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  private authService = inject(AuthService);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  private relatoriosService = inject(RelatoriosService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  userName = '';
  userEmail = '';
  isAdmin = false;
  userRole: 'professor' | 'coordenacao' | 'direcao' | 'secretaria' | null = null;
  loading = true;
  loadingEstatisticas = false;

  // Filtros de período
  periodoSelecionado: 'semana' | 'mes' | 'trimestre' | 'semestre' | 'customizado' = 'mes';
  dataInicio: string = '';
  dataFim: string = '';
  todasOcorrencias: Ocorrencia[] = []; // Cache de todas as ocorrências

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
      
      // Busca o role do usuário dentro do contexto do Angular
      this.ngZone.run(() => {
        this.carregarDadosUsuario();
      });
    } else {
      this.loading = false;
    }
  }
  
  async carregarDadosUsuario() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }
      
      console.log('Iniciando carregamento de dados do usuário');
      
      // Buscar dados do usuário no Firestore para pegar o role
      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      console.log('Usuário carregado:', usuario);
      
      if (usuario) {
        this.userRole = usuario.role;
        this.userName = usuario.nome || this.userName;
        console.log('Role do usuário:', this.userRole);
        
        // Redirecionar secretaria para dashboard próprio
        if (this.userRole === 'secretaria') {
          console.log('Redirecionando para secretaria');
          this.loading = false;
          this.cdr.detectChanges();
          this.router.navigate(['/secretaria/dashboard']);
          return;
        }

        // Carregar estatísticas para coordenação e direção
        if (this.userRole === 'coordenacao' || this.userRole === 'direcao') {
          console.log('Carregando estatísticas');
          try {
            await this.carregarEstatisticas();
          } catch (erro) {
            console.error('Erro ao carregar estatísticas:', erro);
          }
        }
      } else {
        console.warn('Usuário não encontrado no Firestore');
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    } finally {
      // Garantir que a detecção de mudanças aconteça dentro do NgZone
      this.ngZone.run(() => {
        this.loading = false;
        this.cdr.detectChanges();
        console.log('Dashboard loading finalizado:', this.loading, 'Role:', this.userRole);
      });
    }
  }

  async carregarEstatisticas() {
    try {
      this.loadingEstatisticas = true;
      this.cdr.detectChanges();
      
      console.log('Iniciando carregamento de estatísticas');
      
      // Buscar todas as ocorrências da escola do usuário
      const user = this.authService.getCurrentUser();
      if (!user) {
        console.warn('Usuário não autenticado para estatísticas');
        return;
      }

      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      if (!usuario || !usuario.escolaId) {
        console.warn('Usuário ou escolaId não encontrados');
        return;
      }

      console.log('Buscando ocorrências da escola:', usuario.escolaId);
      // Buscar e guardar todas as ocorrências
      this.todasOcorrencias = await this.firestoreService.buscarOcorrencias(usuario.escolaId);
      console.log('Ocorrências carregadas:', this.todasOcorrencias.length);
      
      // Aplicar filtro inicial (último mês)
      this.aplicarFiltroPeriodo();
      
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      // Garantir que a detecção de mudanças aconteça dentro do NgZone
      this.ngZone.run(() => {
        this.loadingEstatisticas = false;
        this.cdr.detectChanges();
      });
    }
  }

  aplicarFiltroPeriodo() {
    if (this.todasOcorrencias.length === 0) return;

    let ocorrenciasFiltradas = [...this.todasOcorrencias];
    const hoje = new Date();

    // Período customizado
    if (this.periodoSelecionado === 'customizado') {
      if (this.dataInicio && this.dataFim) {
        ocorrenciasFiltradas = this.todasOcorrencias.filter(o => {
          return o.data >= this.dataInicio && o.data <= this.dataFim;
        });
      }
      this.estatisticas = this.relatoriosService.calcularEstatisticasOcorrencias(ocorrenciasFiltradas);
      this.prepararDadosGraficos();
      return;
    }

    // Calcular data limite baseada no período selecionado
    let dataLimite: Date;
    switch (this.periodoSelecionado) {
      case 'semana':
        dataLimite = new Date(hoje);
        dataLimite.setDate(hoje.getDate() - 7);
        break;
      case 'mes':
        dataLimite = new Date(hoje);
        dataLimite.setMonth(hoje.getMonth() - 1);
        break;
      case 'trimestre':
        dataLimite = new Date(hoje);
        dataLimite.setMonth(hoje.getMonth() - 3);
        break;
      case 'semestre':
        dataLimite = new Date(hoje);
        dataLimite.setMonth(hoje.getMonth() - 6);
        break;
      default:
        dataLimite = new Date(hoje);
        dataLimite.setMonth(hoje.getMonth() - 1);
    }

    // Filtrar por data limite
    ocorrenciasFiltradas = this.todasOcorrencias.filter(o => {
      const dataOcorrencia = new Date(o.data);
      return dataOcorrencia >= dataLimite;
    });

    // Calcular estatísticas com dados filtrados
    this.estatisticas = this.relatoriosService.calcularEstatisticasOcorrencias(ocorrenciasFiltradas);
    
    // Preparar dados dos gráficos
    this.prepararDadosGraficos();
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

  exportarExcel() {
    if (!this.estatisticas) return;

    // Calcular dados adicionais
    const alunosUnicos = new Set(this.todasOcorrencias.map(o => o.nomeAluno));
    const professoresUnicos = new Set(this.todasOcorrencias.map(o => o.professorNome));
    
    // Contar tipos de ocorrência
    const tiposMap = new Map<string, number>();
    this.todasOcorrencias.forEach(o => {
      const tipos = o.tipoOcorrencia.split(',').map(t => t.trim());
      tipos.forEach(tipo => {
        tiposMap.set(tipo, (tiposMap.get(tipo) || 0) + 1);
      });
    });
    const tiposOrdenados = Array.from(tiposMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Preparar dados para Excel
    const workbook = XLSX.utils.book_new();

    // SHEET 1: Resumo Estatístico
    const resumoData = [
      ['RELATÓRIO DE OCORRÊNCIAS ESCOLARES'],
      ['Data do Relatório:', new Date().toLocaleDateString('pt-BR')],
      ['Período:', this.getPeriodoTexto()],
      [],
      ['ESTATÍSTICAS GERAIS'],
      ['Total de Ocorrências:', this.estatisticas.totalOcorrencias],
      ['Total de Alunos:', alunosUnicos.size],
      ['Total de Professores:', professoresUnicos.size],
      [],
      ['TIPOS DE OCORRÊNCIA MAIS FREQUENTES'],
      ['Tipo', 'Quantidade']
    ];

    tiposOrdenados.forEach(([tipo, quantidade]) => {
      resumoData.push([tipo, quantidade]);
    });

    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    
    // Definir larguras das colunas
    wsResumo['!cols'] = [{ wch: 35 }, { wch: 20 }];
    
    XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo');

    // SHEET 2: Ocorrências Detalhadas
    const ocorrenciasFiltradas = this.todasOcorrencias.filter(o => {
      if (this.periodoSelecionado === 'customizado' && this.dataInicio && this.dataFim) {
        const dataOcorrencia = new Date(o.data);
        return dataOcorrencia >= new Date(this.dataInicio) && dataOcorrencia <= new Date(this.dataFim);
      }
      return true;
    });

    const ocorrenciasData = ocorrenciasFiltradas.map(o => ({
      'Data': this.formatarData(o.data),
      'Aluno': o.nomeAluno,
      'Turma': o.turma,
      'Tipo de Ensino': o.tipoEnsino,
      'Tipo de Ocorrência': o.tipoOcorrencia,
      'Disciplina': o.disciplina,
      'Professor': o.professorNome,
      'Descrição': o.descricao
    }));

    const wsOcorrencias = XLSX.utils.json_to_sheet(ocorrenciasData);
    
    // Definir larguras das colunas para ocorrências
    wsOcorrencias['!cols'] = [
      { wch: 12 }, // Data
      { wch: 25 }, // Aluno
      { wch: 10 }, // Turma
      { wch: 18 }, // Tipo Ensino
      { wch: 30 }, // Tipo Ocorrência
      { wch: 20 }, // Disciplina
      { wch: 25 }, // Professor
      { wch: 50 }  // Descrição
    ];

    XLSX.utils.book_append_sheet(workbook, wsOcorrencias, 'Ocorrências');

    // SHEET 3: Ranking de Turmas
    const turmasData = this.estatisticas.ocorrenciasPorTurma.map(t => ({
      'Turma': t.turma,
      'Quantidade de Ocorrências': t.quantidade
    }));

    const wsTurmas = XLSX.utils.json_to_sheet(turmasData);
    wsTurmas['!cols'] = [{ wch: 15 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(workbook, wsTurmas, 'Ranking Turmas');

    // SHEET 4: Ranking de Alunos
    const alunosData = this.estatisticas.topAlunos.map(a => ({
      'Aluno': a.nome,
      'Quantidade de Ocorrências': a.quantidade
    }));

    const wsAlunos = XLSX.utils.json_to_sheet(alunosData);
    wsAlunos['!cols'] = [{ wch: 30 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(workbook, wsAlunos, 'Ranking Alunos');

    // Gerar arquivo
    const nomeArquivo = `relatorio-ocorrencias-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, nomeArquivo);
  }

  private getPeriodoTexto(): string {
    switch (this.periodoSelecionado) {
      case 'semana': return 'Última Semana';
      case 'mes': return 'Último Mês';
      case 'trimestre': return 'Último Trimestre';
      case 'semestre': return 'Último Semestre';
      case 'customizado': 
        if (this.dataInicio && this.dataFim) {
          return `${this.formatarData(this.dataInicio)} a ${this.formatarData(this.dataFim)}`;
        }
        return 'Período Customizado';
      default: return 'Todos os Períodos';
    }
  }

  private formatarData(data: string): string {
    const partes = data.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
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

  goToAgendamento() {
    this.router.navigate(['/agendamento-equipamentos']);
  }
}
