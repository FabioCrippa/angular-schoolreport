import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FirestoreService, ControleEntradaSaida } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-relatorio-dia',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './relatorio-dia.html',
  styleUrl: './relatorio-dia.scss',
})
export class RelatorioDia implements OnInit {
  
  private router = inject(Router);
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);
  private cdr = inject(ChangeDetectorRef);
  
  loading = true;
  registros: ControleEntradaSaida[] = [];
  registrosFiltrados: ControleEntradaSaida[] = [];
  dataHoje = '';
  
  // Filtros
  filtroTipo: 'todos' | 'atraso' | 'saida' = 'todos';
  filtroAluno = '';
  filtroTurma = '';
  
  // Estatísticas
  totalAtrasos = 0;
  totalSaidas = 0;
  
  ngOnInit() {
    this.dataHoje = new Date().toLocaleDateString('pt-BR');
    this.carregarRegistros();
  }
  
  async carregarRegistros() {
    try {
      this.loading = true;
      const escolaId = await this.authService.getEscolaId();
      
      if (!escolaId) {
        alert('Erro: Usuário não vinculado a nenhuma escola.');
        this.router.navigate(['/secretaria/dashboard']);
        return;
      }
      
      const hoje = new Date().toISOString().split('T')[0];
      this.registros = await this.firestoreService.buscarControles(escolaId, hoje);
      
      // Ordenar por horário (mais recentes primeiro)
      this.registros.sort((a, b) => {
        return b.horario.localeCompare(a.horario);
      });
      
      this.calcularEstatisticas();
      this.aplicarFiltros();
      
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      alert('Erro ao carregar registros do dia.');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
  
  calcularEstatisticas() {
    this.totalAtrasos = this.registros.filter(r => r.tipo === 'atraso').length;
    this.totalSaidas = this.registros.filter(r => r.tipo === 'saida').length;
  }
  
  aplicarFiltros() {
    this.registrosFiltrados = this.registros.filter(registro => {
      // Filtro por tipo
      const matchTipo = this.filtroTipo === 'todos' || registro.tipo === this.filtroTipo;
      
      // Filtro por aluno
      const matchAluno = !this.filtroAluno || 
        registro.alunoNome.toLowerCase().includes(this.filtroAluno.toLowerCase());
      
      // Filtro por turma
      const matchTurma = !this.filtroTurma || 
        registro.turma.toLowerCase().includes(this.filtroTurma.toLowerCase());
      
      return matchTipo && matchAluno && matchTurma;
    });
  }
  
  limparFiltros() {
    this.filtroTipo = 'todos';
    this.filtroAluno = '';
    this.filtroTurma = '';
    this.aplicarFiltros();
  }
  
  toggleExpansao(registro: ControleEntradaSaida) {
    registro.expandido = !registro.expandido;
  }
  
  getTipoLabel(tipo: string): string {
    return tipo === 'atraso' ? 'Atraso' : 'Saída Antecipada';
  }
  
  getTipoIcon(tipo: string): string {
    return tipo === 'atraso' ? '🕐' : '🚪';
  }
  
  formatarData(data: string): string {
    // Converte 'YYYY-MM-DD' para 'DD/MM/YYYY'
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  
  voltar() {
    this.router.navigate(['/secretaria/dashboard']);
  }
}
