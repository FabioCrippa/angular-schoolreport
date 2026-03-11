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
  frequencia: number; // porcentagem baseada nos dias registrados
  nivel: 'ok' | 'atencao' | 'risco'; // ok=<38f, atencao=38-50f, risco=>50f
  emRisco: boolean; // > 50 faltas (reprovou)
}

interface TurmaFrequencia {
  turma: string;
  alunos: AlunoFrequencia[];
  mediaFrequencia: number;
  alunosEmRisco: number;    // reprovou (>50)
  alunosAtencao: number;   // em risco (38-50)
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

  readonly DIAS_LETIVOS = 200;
  readonly LIMITE_FALTAS = 50;   // 25% de 200 dias letivos
  readonly LIMITE_ATENCAO = 38;  // ~76% do limite

  // Resumo geral
  totalReprovados = 0;
  totalAtencao = 0;
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

    // Contar dias letivos registrados por turma (denominador correto para % frequência)
    const diasPorTurma = new Map<string, Set<string>>();
    faltasDoAno.forEach(falta => {
      if (!diasPorTurma.has(falta.turma)) {
        diasPorTurma.set(falta.turma, new Set());
      }
      diasPorTurma.get(falta.turma)!.add(falta.data);
    });

    // Agrupar por turma → aluno (contar apenas faltas)
    const mapa = new Map<string, Map<string, { nome: string; faltas: number }>>();

    for (const falta of faltasDoAno) {
      if (!falta.alunos) continue;

      if (!mapa.has(falta.turma)) {
        mapa.set(falta.turma, new Map());
      }
      const turmaMap = mapa.get(falta.turma)!;

      for (const [alunoId, dados] of Object.entries(falta.alunos)) {
        if (!turmaMap.has(alunoId)) {
          turmaMap.set(alunoId, { nome: dados.alunoNome, faltas: 0 });
        }
        if (!dados.presente) {
          turmaMap.get(alunoId)!.faltas++;
        }
      }
    }

    // Converter para arrays ordenados
    this.todasAsTurmas = [];
    let maxFaltas = -1;

    for (const [turma, alunosMap] of mapa) {
      const diasRegistrados = diasPorTurma.get(turma)?.size ?? 1;
      const alunos: AlunoFrequencia[] = [];

      for (const [alunoId, dados] of alunosMap) {
        // Frequência baseada nos 200 dias letivos anuais (denominador fixo)
        // Evita distorções quando poucos dias foram registrados
        const freq = ((this.DIAS_LETIVOS - dados.faltas) / this.DIAS_LETIVOS) * 100;
        const nivel = dados.faltas > this.LIMITE_FALTAS
          ? 'risco'
          : dados.faltas >= this.LIMITE_ATENCAO
          ? 'atencao'
          : 'ok';
        alunos.push({
          alunoId,
          alunoNome: dados.nome,
          totalDias: diasRegistrados,
          totalFaltas: dados.faltas,
          frequencia: Math.round(Math.max(freq, 0) * 10) / 10,
          nivel,
          emRisco: dados.faltas > this.LIMITE_FALTAS
        });
      }

      alunos.sort((a, b) => a.frequencia - b.frequencia);

      const mediaFreq = alunos.length
        ? alunos.reduce((s, a) => s + a.frequencia, 0) / alunos.length
        : 100;
      const alunosEmRisco = alunos.filter(a => a.emRisco).length;
      const alunosAtencao = alunos.filter(a => a.nivel === 'atencao').length;
      const totalFaltasNaTurma = alunos.reduce((s, a) => s + a.totalFaltas, 0);

      if (totalFaltasNaTurma > maxFaltas) {
        maxFaltas = totalFaltasNaTurma;
        this.turmaMaisFaltas = turma;
      }

      this.todasAsTurmas.push({
        turma,
        alunos,
        mediaFrequencia: Math.round(mediaFreq * 10) / 10,
        alunosEmRisco,
        alunosAtencao
      });
    }

    this.todasAsTurmas.sort((a, b) => a.turma.localeCompare(b.turma));
    this.totalReprovados = this.todasAsTurmas.reduce((s, t) => s + t.alunosEmRisco, 0);
    this.totalAtencao = this.todasAsTurmas.reduce((s, t) => s + t.alunosAtencao, 0);
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

  getNivelTurma(turma: TurmaFrequencia): string {
    if (turma.alunosEmRisco > 0) return 'risco';
    if (turma.alunosAtencao > 0) return 'atencao';
    return 'ok';
  }

  pctLimite(totalFaltas: number): number {
    return Math.min(Math.round((totalFaltas / this.LIMITE_FALTAS) * 100), 100);
  }

  voltar() {
    this.router.navigate(['/dashboard']);
  }
}
