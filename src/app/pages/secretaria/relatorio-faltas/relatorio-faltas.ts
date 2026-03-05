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
}

interface ResumoFaltas {
  criticos: AlunoFalta[]; // 3+ dias
  atencao: AlunoFalta[]; // 2 dias
  normais: AlunoFalta[]; // 1 dia
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
  
  voltar() {
    this.router.navigate(['/secretaria/dashboard']);
  }
}
