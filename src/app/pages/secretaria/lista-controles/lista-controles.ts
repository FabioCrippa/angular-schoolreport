import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FirestoreService, ControleEntradaSaida } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-lista-controles',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './lista-controles.html',
  styleUrl: './lista-controles.scss',
})
export class ListaControles implements OnInit {
  
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  
  controles: ControleEntradaSaida[] = [];
  controlesFiltrados: ControleEntradaSaida[] = [];
  loading = true;
  userName: string | null = null;
  
  // Filtros
  filtroAluno = '';
  filtroTurma = '';
  filtroTipo: 'todos' | 'atraso' | 'saida' = 'todos';
  filtroPeriodo: 'hoje' | 'semana' | 'mes' | 'todos' = 'hoje';
  turmasUnicas: string[] = [];
  
  // Modal de confirmação de exclusão
  modalExclusaoAberto = false;
  controleExcluindo: ControleEntradaSaida | null = null;
  
  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.displayName || user.email || null;
    }
    
    this.carregarControles();
  }
  
  async carregarControles() {
    try {
      this.loading = true;
      
      const escolaId = await this.authService.getEscolaId();
      
      if (!escolaId) {
        alert('Erro: Usuário não vinculado a nenhuma escola. Contate o administrador.');
        this.loading = false;
        return;
      }
      
      // Busca todos os controles da escola
      const todosControles = await this.firestoreService.buscarControles(escolaId);
      
      // Ordena por data: mais recentes primeiro
      todosControles.sort((a, b) => {
        const dataA = new Date(a.data + ' ' + a.horario).getTime();
        const dataB = new Date(b.data + ' ' + b.horario).getTime();
        return dataB - dataA;
      });
      
      this.controles = todosControles;
      
      // Extrai turmas únicas
      const turmasSet = new Set(this.controles.map(c => c.turma));
      this.turmasUnicas = Array.from(turmasSet).sort();
      
      this.aplicarFiltros();
      this.loading = false;
      
    } catch (error) {
      console.error('Erro ao carregar controles:', error);
      alert('Erro ao carregar registros. Por favor, tente novamente.');
      this.loading = false;
    }
  }
  
  aplicarFiltros() {
    let controlesFiltrados = [...this.controles];
    
    // Filtro por período
    if (this.filtroPeriodo !== 'todos') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      controlesFiltrados = controlesFiltrados.filter(controle => {
        const dataControle = new Date(controle.data);
        dataControle.setHours(0, 0, 0, 0);
        
        if (this.filtroPeriodo === 'hoje') {
          return dataControle.getTime() === hoje.getTime();
        } else if (this.filtroPeriodo === 'semana') {
          const umaSemanaAtras = new Date(hoje);
          umaSemanaAtras.setDate(hoje.getDate() - 7);
          return dataControle >= umaSemanaAtras;
        } else if (this.filtroPeriodo === 'mes') {
          const umMesAtras = new Date(hoje);
          umMesAtras.setMonth(hoje.getMonth() - 1);
          return dataControle >= umMesAtras;
        }
        return true;
      });
    }
    
    // Filtro por tipo
    if (this.filtroTipo !== 'todos') {
      controlesFiltrados = controlesFiltrados.filter(c => c.tipo === this.filtroTipo);
    }
    
    // Filtro por aluno
    if (this.filtroAluno.trim()) {
      controlesFiltrados = controlesFiltrados.filter(c =>
        c.alunoNome.toLowerCase().includes(this.filtroAluno.toLowerCase())
      );
    }
    
    // Filtro por turma
    if (this.filtroTurma) {
      controlesFiltrados = controlesFiltrados.filter(c => c.turma === this.filtroTurma);
    }
    
    this.controlesFiltrados = controlesFiltrados;
  }
  
  limparFiltros() {
    this.filtroAluno = '';
    this.filtroTurma = '';
    this.filtroTipo = 'todos';
    this.filtroPeriodo = 'hoje';
    this.aplicarFiltros();
  }
  
  toggleExpansao(controle: ControleEntradaSaida) {
    controle.expandido = !controle.expandido;
  }
  
  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  
  getTipoBadgeClass(tipo: string): string {
    return tipo === 'atraso' ? 'badge-atraso' : 'badge-saida';
  }
  
  getTipoLabel(tipo: string): string {
    return tipo === 'atraso' ? 'Atraso' : 'Saída Antecipada';
  }
  
  // Exportar para Excel
  exportarExcel() {
    if (this.controlesFiltrados.length === 0) {
      alert('Não há registros para exportar.');
      return;
    }
    
    // Prepara dados
    const dadosExcel = this.controlesFiltrados.map(controle => ({
      'Data': this.formatarData(controle.data),
      'Horário': controle.horario,
      'Tipo': this.getTipoLabel(controle.tipo),
      'Aluno': controle.alunoNome,
      'Turma': controle.turma,
      'Tipo de Ensino': controle.tipoEnsino,
      'Motivo': controle.motivo || '',
      'Aula Permitida': controle.aulaPermitida || '',
      'Responsável': controle.responsavel || '',
      'Telefone': controle.telefoneResponsavel || '',
      'Registrado Por': controle.registradoPorNome
    }));
    
    // Cria planilha
    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Controles');
    
    // Define largura das colunas
    const colWidths = [
      { wch: 12 }, // Data
      { wch: 10 }, // Horário
      { wch: 16 }, // Tipo
      { wch: 30 }, // Aluno
      { wch: 15 }, // Turma
      { wch: 18 }, // Tipo de Ensino
      { wch: 35 }, // Motivo
      { wch: 15 }, // Aula Permitida
      { wch: 25 }, // Responsável
      { wch: 18 }, // Telefone
      { wch: 25 }  // Registrado Por
    ];
    ws['!cols'] = colWidths;
    
    // Download
    const nomeArquivo = `controles_entrada_saida_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
  }
  
  // Modal de exclusão
  abrirModalExclusao(controle: ControleEntradaSaida) {
    this.controleExcluindo = controle;
    this.modalExclusaoAberto = true;
  }
  
  fecharModalExclusao() {
    this.modalExclusaoAberto = false;
    this.controleExcluindo = null;
  }
  
  async confirmarExclusao() {
    if (!this.controleExcluindo?.id) return;
    
    try {
      await this.firestoreService.deletarControle(this.controleExcluindo.id);
      alert('Registro excluído com sucesso!');
      this.fecharModalExclusao();
      await this.carregarControles();
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      alert('Erro ao excluir registro. Por favor, tente novamente.');
    }
  }
  
  voltar() {
    this.router.navigate(['/secretaria/dashboard']);
  }
}
