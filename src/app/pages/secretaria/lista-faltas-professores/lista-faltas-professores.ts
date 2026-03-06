import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, FaltaProfessor } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-lista-faltas-professores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-faltas-professores.html',
  styleUrl: './lista-faltas-professores.scss'
})
export class ListaFaltasProfessores implements OnInit {

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  escolaId = '';
  faltas: FaltaProfessor[] = [];
  faltasFiltradas: FaltaProfessor[] = [];

  // Filtros
  filtroNome = '';
  filtroPeriodo: 'manha' | 'tarde' | 'noite' | '' = '';
  filtroDataDe = '';
  filtroDataAte = '';

  ngOnInit() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    this.filtroDataDe = primeiroDia.toISOString().split('T')[0];
    this.filtroDataAte = hoje.toISOString().split('T')[0];
    this.carregarDados();
  }

  async carregarDados() {
    try {
      this.loading = true;
      const user = this.authService.getCurrentUser();
      if (user) {
        const usuario = await this.firestoreService.buscarUsuario(user.uid);
        if (usuario) {
          this.escolaId = usuario.escolaId;
          this.faltas = await this.firestoreService.obterFaltasProfessores(this.escolaId);
          this.aplicarFiltros();
        }
      }
    } catch (error) {
      console.error('Erro ao carregar faltas de professores:', error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  aplicarFiltros() {
    let resultado = [...this.faltas];

    if (this.filtroDataDe) {
      resultado = resultado.filter(f => f.data >= this.filtroDataDe);
    }
    if (this.filtroDataAte) {
      resultado = resultado.filter(f => f.data <= this.filtroDataAte);
    }
    if (this.filtroPeriodo) {
      resultado = resultado.filter(f => f.periodo === this.filtroPeriodo);
    }
    if (this.filtroNome.trim()) {
      const termo = this.filtroNome.toLowerCase();
      resultado = resultado.filter(f => f.professorNome.toLowerCase().includes(termo));
    }

    this.faltasFiltradas = resultado;
    this.cdr.markForCheck();
  }

  limparFiltros() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    this.filtroDataDe = primeiroDia.toISOString().split('T')[0];
    this.filtroDataAte = hoje.toISOString().split('T')[0];
    this.filtroNome = '';
    this.filtroPeriodo = '';
    this.aplicarFiltros();
  }

  formatarData(data: string): string {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  labelPeriodo(periodo: string): string {
    const map: { [k: string]: string } = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
    return map[periodo] || periodo;
  }

  formatarAulas(aulas: { turma: string; numeroAula: string }[]): string {
    return aulas.map(a => `${a.turma} – ${a.numeroAula}`).join(', ');
  }

  exportarExcel() {
    const dados = this.faltasFiltradas.map(f => ({
      'Data': this.formatarData(f.data),
      'Professor Ausente': f.professorNome,
      'Período': this.labelPeriodo(f.periodo),
      'Aulas': this.formatarAulas(f.aulas),
      'Professor Eventual': f.professorEventual || '—',
      'Registrado por': f.registradoPorNome
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [
      { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 40 }, { wch: 22 }, { wch: 22 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faltas Professores');

    const dataStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `faltas-professores-${dataStr}.xlsx`);
  }

  voltar() {
    this.router.navigate(['/secretaria/dashboard']);
  }
}
