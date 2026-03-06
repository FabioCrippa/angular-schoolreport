import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

interface AlunoFalta {
  alunoId: string;
  alunoNome: string;
  turma: string;
  serie: string;
  diasConsecutivos: number;
  ultimaFalta: string; // YYYY-MM-DD
  datas: string[]; // array de datas de faltas consecutivas
  contatado: boolean;
  statusContato?: 'conversa' | 'nao_conseguiu' | 'recado' | 'ligar_novamente';
}

interface ResumoFaltas {
  criticos: AlunoFalta[]; // 3+ dias
  atencao: AlunoFalta[]; // 2 dias
  normais: AlunoFalta[]; // 1 dia
}

interface Conversa {
  id?: string;
  alunoId: string;
  alunoNome: string;
  responsavel: string;
  resultadoContato: 'conversa' | 'nao_conseguiu' | 'recado' | 'ligar_novamente';
  notas: string;
  registradoEm: Date;
  registradoPor: string;
  registradoPorNome: string;
}

@Component({
  selector: 'app-relatorio-faltas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './relatorio-faltas.html',
  styleUrl: './relatorio-faltas.scss'
})
export class RelatorioFaltas implements OnInit {
  
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  escolaId = '';
  loading = false;
  
  // Dados
  alunosFaltosos: AlunoFalta[] = [];
  resumo: ResumoFaltas = { criticos: [], atencao: [], normais: [] };
  
  // Modal de Conversas
  modalAberto = false;
  alunoSelecionado: AlunoFalta | null = null;
  conversasHistorico: Conversa[] = [];
  usuarioId = '';
  usuarioNome = '';
  
  // Formulário de Nova Conversa
  novaConversa = {
    responsavel: '',
    resultadoContato: 'conversa' as 'conversa' | 'nao_conseguiu' | 'recado' | 'ligar_novamente',
    notas: ''
  };
  
  // Filtros
  filtroTurma = '';
  filtroStatus: 'todos' | 'criticos' | 'atencao' | 'normais' = 'todos';
  filtroNome = '';
  
  // Dados filtered
  listaFiltrada: AlunoFalta[] = [];
  turmasDisponiveis: string[] = [];
  
  ngOnInit() {
    this.carregarDados();
  }
  
  async carregarDados() {
    try {
      const user = this.authService.getCurrentUser();
      if (user) {
        const usuario = await this.firestoreService.buscarUsuario(user.uid);
        if (usuario) {
          this.escolaId = usuario.escolaId;
          this.usuarioId = user.uid;
          this.usuarioNome = usuario.nome;
          await this.procesarFaltas();
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  }
  
  async procesarFaltas() {
    try {
      this.loading = true;
      
      // Buscar todas as faltas dos últimos 30 dias
      const agora = new Date();
      agora.setHours(0, 0, 0, 0);
      const trinta_dias_atras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Para simplificar, vamos buscar todas as faltas e filtrar aqui
      // (em produção, você poderia fazer isto no Firestore)
      const faltas = await this.firestoreService.obterFaltasPorEscola(this.escolaId);
      
      // Filtrar faltas pelos últimos 30 dias
      const faltasFiltradas = faltas.filter(falta => {
        const dataFalta = new Date(falta.data);
        dataFalta.setHours(0, 0, 0, 0);
        return dataFalta >= trinta_dias_atras && dataFalta <= agora;
      });
      
      // Processar faltas para encontrar padrões consecutivos
      const mapa = new Map<string, AlunoFalta>();
      
      // Agrupar por aluno
      faltasFiltradas.forEach(falta => {
        Object.entries(falta.alunos).forEach(([alunoId, aluno]: [string, any]) => {
          const key = `${alunoId}-${aluno.alunoNome}`;
          if (!mapa.has(key)) {
            mapa.set(key, {
              alunoId,
              alunoNome: aluno.alunoNome,
              turma: falta.turma,
              serie: '', // Será preenchido depois se tiver
              diasConsecutivos: 0,
              ultimaFalta: '',
              datas: [],
              contatado: false
            });
          }
          
          // Se não estava presente, registrar a falta
          if (!aluno.presente) {
            const item = mapa.get(key)!;
            item.datas.push(falta.data);
            item.ultimaFalta = falta.data;
          }
        });
      });
      
      // Calcular dias consecutivos
      const alunosProcessados: AlunoFalta[] = [];
      
      mapa.forEach(aluno => {
        // Ordenar datas
        aluno.datas.sort().reverse(); // Mais recente primeiro
        
        // Calcular sequência consecutiva (apenas a sequência mais recente)
        if (aluno.datas.length > 0) {
          const diasConsecutivos = this.calcularDiasConsecutivos(aluno.datas);
          aluno.diasConsecutivos = diasConsecutivos;
          
          // Só incluir se tem 1+ dias de falta consecutivos
          if (diasConsecutivos >= 1) {
            alunosProcessados.push(aluno);
          }
        }
      });
      
      // Ordenar por dias consecutivos (maior primeiro)
      alunosProcessados.sort((a, b) => b.diasConsecutivos - a.diasConsecutivos);
      
      this.alunosFaltosos = alunosProcessados;
      
      // Extrair turmas disponíveis
      this.turmasDisponiveis = [...new Set(alunosProcessados.map(a => a.turma))].sort();
      
      // Gerar resumo
      this.gerarResumo();
      
      // Carregar status de contato (para marcar checkbox)
      await this.carregarStatusesContato();
      
      // Aplicar filtros
      this.aplicarFiltros();
      
    } catch (error) {
      console.error('Erro ao processar faltas:', error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  
  /**
   * Calcula o número de dias consecutivos sem presença a partir de um array de datas
   * @param datas Array de datas ordenado (mais recente primeiro)
   * @returns Número de dias consecutivos a partir da data mais recente
   */
  private calcularDiasConsecutivos(datas: string[]): number {
    if (datas.length === 0) return 0;
    
    let sequencia = 1;
    let ultimaData = new Date(datas[0]);
    ultimaData.setHours(0, 0, 0, 0);
    
    for (let i = 1; i < datas.length; i++) {
      const dataAtual = new Date(datas[i]);
      dataAtual.setHours(0, 0, 0, 0);
      
      // Calcular diferença em dias
      const diffMs = ultimaData.getTime() - dataAtual.getTime();
      const diff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      // Se a diferença for exatamente 1 dia, é consecutivo
      if (diff === 1) {
        sequencia++;
        ultimaData = dataAtual;
      } else {
        // Se não for consecutivo, parar (queremos apenas a sequência mais recente)
        break;
      }
    }
    
    return sequencia;
  }
  
  gerarResumo() {
    this.resumo = {
      criticos: this.alunosFaltosos.filter(a => a.diasConsecutivos >= 3),
      atencao: this.alunosFaltosos.filter(a => a.diasConsecutivos === 2),
      normais: this.alunosFaltosos.filter(a => a.diasConsecutivos === 1)
    };
  }
  
  aplicarFiltros() {
    let resultado = [...this.alunosFaltosos];
    
    // Filtro por turma
    if (this.filtroTurma) {
      resultado = resultado.filter(a => a.turma === this.filtroTurma);
    }
    
    // Filtro por status
    if (this.filtroStatus === 'criticos') {
      resultado = resultado.filter(a => a.diasConsecutivos >= 3);
    } else if (this.filtroStatus === 'atencao') {
      resultado = resultado.filter(a => a.diasConsecutivos === 2);
    } else if (this.filtroStatus === 'normais') {
      resultado = resultado.filter(a => a.diasConsecutivos === 1);
    }
    
    // Filtro por nome
    if (this.filtroNome) {
      const termo = this.filtroNome.toLowerCase();
      resultado = resultado.filter(a => a.alunoNome.toLowerCase().includes(termo));
    }
    
    this.listaFiltrada = resultado;
  }
  
  aoMudarFiltro() {
    this.aplicarFiltros();
    this.cdr.markForCheck();
  }
  
  obterStatusClass(diasConsecutivos: number): string {
    if (diasConsecutivos >= 3) return 'critico';
    if (diasConsecutivos === 2) return 'atencao';
    return 'normal';
  }
  
  obterStatusLabel(diasConsecutivos: number): string {
    if (diasConsecutivos >= 3) return '🔴 CRÍTICO';
    if (diasConsecutivos === 2) return '🟡 ATENÇÃO';
    return '🟢 Normal';
  }
  
  async marcarContatado(aluno: AlunoFalta) {
    try {
      aluno.contatado = !aluno.contatado;
      // TODO: Persistir no Firestore quando implementarmos o campo contatado
      console.log(`✅ ${aluno.alunoNome} marcado como ${aluno.contatado ? 'contactado' : 'não contactado'}`);
    } catch (error) {
      console.error('Erro ao marcar contatado:', error);
    }
  }
  
  async abrirModalConversa(aluno: AlunoFalta) {
    try {
      this.alunoSelecionado = aluno;
      this.novaConversa = {
        responsavel: '',
        resultadoContato: 'conversa' as 'conversa' | 'nao_conseguiu' | 'recado' | 'ligar_novamente',
        notas: ''
      };
      
      // Carregar histórico de conversas
      await this.carregarHistoricoConversas(aluno.alunoId);
      
      this.modalAberto = true;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Erro ao abrir modal:', error);
    }
  }
  
  fecharModal() {
    this.modalAberto = false;
    this.alunoSelecionado = null;
    this.conversasHistorico = [];
    this.cdr.markForCheck();
  }

  async carregarStatusesContato() {
    try {
      // Para cada aluno, buscar status de contato e marcar como contatado se existir
      for (const aluno of this.alunosFaltosos) {
        const status = await this.firestoreService.obterStatusBuscaAtiva(this.escolaId, aluno.alunoId);
        if (status) {
          aluno.contatado = true;
          aluno.statusContato = status.resultado;
        }
      }
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Erro ao carregar status de contato:', error);
    }
  }
  
  async carregarHistoricoConversas(alunoId: string) {
    try {
      this.conversasHistorico = await this.firestoreService.obterConversas(this.escolaId, alunoId);
      // Ordenar por data mais recente primeiro
      this.conversasHistorico.sort((a, b) => 
        new Date(b.registradoEm).getTime() - new Date(a.registradoEm).getTime()
      );
      // Mostrar apenas últimas 5 conversas
      this.conversasHistorico = this.conversasHistorico.slice(0, 5);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      this.conversasHistorico = [];
    }
  }
  
  async salvarConversa() {
    try {
      if (!this.alunoSelecionado || !this.novaConversa.responsavel.trim()) {
        console.error('Preencha os campos obrigatórios');
        return;
      }
      
      const conversa: Omit<Conversa, 'id' | 'escolaId'> = {
        alunoId: this.alunoSelecionado.alunoId,
        alunoNome: this.alunoSelecionado.alunoNome,
        responsavel: this.novaConversa.responsavel,
        resultadoContato: this.novaConversa.resultadoContato,
        notas: this.novaConversa.notas,
        registradoEm: new Date(),
        registradoPor: this.usuarioId,
        registradoPorNome: this.usuarioNome
      };
      
      await this.firestoreService.salvarConversa(this.escolaId, conversa);
      
      // Registrar status de busca ativa (para persistir o checkbox)
      await this.firestoreService.registrarStatusBuscaAtiva(this.escolaId, {
        escolaId: this.escolaId,
        alunoId: this.alunoSelecionado.alunoId,
        alunoNome: this.alunoSelecionado.alunoNome,
        ultimoContato: new Date(),
        resultado: this.novaConversa.resultadoContato,
        registradoPor: this.usuarioId,
        registradoPorNome: this.usuarioNome
      });
      
      // Marcar aluno como contatado
      this.alunoSelecionado.contatado = true;
      this.alunoSelecionado.statusContato = this.novaConversa.resultadoContato;
      
      console.log('✅ Conversa registrada com sucesso');
      
      // Recarregar histórico
      await this.carregarHistoricoConversas(this.alunoSelecionado.alunoId);
      
      // Limpar formulário
      this.novaConversa = {
        responsavel: '',
        resultadoContato: 'conversa' as 'conversa' | 'nao_conseguiu' | 'recado' | 'ligar_novamente',
        notas: ''
      };
      
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Erro ao salvar conversa:', error);
    }
  }
  
  obterLabelResultado(resultado: string): string {
    const labels: { [key: string]: string } = {
      'conversa': '✅ Conversa com Responsável',
      'nao_conseguiu': '❌ Não Conseguiu Contato',
      'recado': '⏳ Deixou Recado',
      'ligar_novamente': '🔄 Ligar Novamente'
    };
    return labels[resultado] || resultado;
  }

  obterCorStatus(resultado: string): string {
    const cores: { [key: string]: string } = {
      'conversa': '#28a745',        // Verde
      'nao_conseguiu': '#dc3545',   // Vermelho
      'recado': '#ffc107',          // Amarelo
      'ligar_novamente': '#fd7e14'  // Laranja
    };
    return cores[resultado] || '#6c757d'; // Cinza padrão
  }

  obterTextoBadge(resultado: string): string {
    const textos: { [key: string]: string } = {
      'conversa': 'Conversou',
      'nao_conseguiu': 'Não atendeu',
      'recado': 'Deixou recado',
      'ligar_novamente': 'Ligar novamente'
    };
    return textos[resultado] || resultado;
  }
  
  voltar() {
    this.router.navigate(['/secretaria/dashboard']);
  }
}
