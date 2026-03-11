import { Component, inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, Falta } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

interface AlunoFrequencia {
  alunoId: string;
  alunoNome: string;
  totalDias: number;
  totalFaltas: number;
  frequencia: number; // porcentagem
  emRisco: boolean;
}

interface TurmaFrequencia {
  turma: string;
  alunos: AlunoFrequencia[];
  mediaFrequencia: number;
  alunosEmRisco: number;
}

@Component({
  selector: 'app-painel-frequencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './painel-frequencia.html',
  styleUrl: './painel-frequencia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PainelFrequencia implements OnInit {

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  escolaId = '';
  loading = false;
  mensagem = '';

  // Filtros
  anoSelecionado: number = new Date().getFullYear();
  filtroTurma = '';
  anos: number[] = [];

  // Dados
  todasAsTurmas: TurmaFrequencia[] = [];
  turmasFiltradas: TurmaFrequencia[] = [];
  turmaExpandida: string | null = null;

  // Resumo geral
  totalAlunosEmRisco = 0;
  turmaMaisFaltas = '';
  totalTurmas = 0;

  ngOnInit() {
    const anoAtual = new Date().getFullYear();
    this.anos = [anoAtual - 1, anoAtual, anoAtual + 1];
    this.carregarDados();
  }

  async carregarDados() {
    try {
      this.loading = true;
      this.cdr.markForCheck();

      const user = this.authService.getCurrentUser();
      if (!user) return;

      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      if (!usuario?.escolaId) return;

      this.escolaId = usuario.escolaId;
      await this.processarFrequencia();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.mensagem = 'Erro ao carregar dados. Tente novamente.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async processarFrequencia() {
    const faltas = await this.firestoreService.obterFaltasPorEscola(this.escolaId);

    // Filtrar pelo ano selecionado
    const faltasDoAno = faltas.filter(f => f.data.startsWith(String(this.anoSelecionado)));

    // Agrupar por turma → aluno
    const mapa = new Map<string, Map<string, { nome: string; faltas: number; total: number }>>();

    for (const falta of faltasDoAno) {
      if (!falta.alunos) continue;

      if (!mapa.has(falta.turma)) {
        mapa.set(falta.turma, new Map());
      }
      const turmaMap = mapa.get(falta.turma)!;

      for (const [alunoId, dados] of Object.entries(falta.alunos)) {
        if (!turmaMap.has(alunoId)) {
          turmaMap.set(alunoId, { nome: dados.alunoNome, faltas: 0, total: 0 });
        }
        const aluno = turmaMap.get(alunoId)!;
        aluno.total++;
        if (!dados.presente) aluno.faltas++;
      }
    }

    // Converter para arrays ordenados
    this.todasAsTurmas = [];
    let maxFaltas = -1;

    for (const [turma, alunosMap] of mapa) {
      const alunos: AlunoFrequencia[] = [];

      for (const [alunoId, dados] of alunosMap) {
        const freq = dados.total > 0 ? ((dados.total - dados.faltas) / dados.total) * 100 : 100;
        alunos.push({
          alunoId,
          alunoNome: dados.nome,
          totalDias: dados.total,
          totalFaltas: dados.faltas,
          frequencia: Math.round(freq * 10) / 10,
          emRisco: freq < 75
        });
      }

      alunos.sort((a, b) => a.frequencia - b.frequencia);

      const mediaFreq = alunos.length
        ? alunos.reduce((s, a) => s + a.frequencia, 0) / alunos.length
        : 100;
      const alunosEmRisco = alunos.filter(a => a.emRisco).length;
      const totalFaltasNaTurma = alunos.reduce((s, a) => s + a.totalFaltas, 0);

      if (totalFaltasNaTurma > maxFaltas) {
        maxFaltas = totalFaltasNaTurma;
        this.turmaMaisFaltas = turma;
      }

      this.todasAsTurmas.push({
        turma,
        alunos,
        mediaFrequencia: Math.round(mediaFreq * 10) / 10,
        alunosEmRisco
      });
    }

    this.todasAsTurmas.sort((a, b) => a.turma.localeCompare(b.turma));
    this.totalAlunosEmRisco = this.todasAsTurmas.reduce((s, t) => s + t.alunosEmRisco, 0);
    this.totalTurmas = this.todasAsTurmas.length;

    this.aplicarFiltros();
  }

  aplicarFiltros() {
    this.turmasFiltradas = this.filtroTurma
      ? this.todasAsTurmas.filter(t => t.turma.toLowerCase().includes(this.filtroTurma.toLowerCase()))
      : [...this.todasAsTurmas];
    this.cdr.markForCheck();
  }

  async onAnoChange() {
    this.loading = true;
    this.cdr.markForCheck();
    await this.processarFrequencia();
    this.loading = false;
    this.cdr.markForCheck();
  }

  toggleTurma(turma: string) {
    this.turmaExpandida = this.turmaExpandida === turma ? null : turma;
    this.cdr.markForCheck();
  }

  getFrequenciaClass(freq: number): string {
    if (freq < 75) return 'risco';
    if (freq < 85) return 'atencao';
    return 'ok';
  }

  voltar() {
    this.router.navigate(['/dashboard']);
  }
}
