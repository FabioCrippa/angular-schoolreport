import { Component, inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, Ocorrencia } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

interface ItemRanking {
  label: string;
  total: number;
  pct: number; // % em relação ao máximo da lista
}

interface MesSerie {
  mes: string; // Ex: "Jan", "Fev"
  total: number;
  pct: number;
}

@Component({
  selector: 'app-estatisticas-ocorrencias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './estatisticas-ocorrencias.html',
  styleUrl: './estatisticas-ocorrencias.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstatisticasOcorrencias implements OnInit {

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  escolaId = '';
  loading = false;

  anoSelecionado: number = new Date().getFullYear();
  anos: number[] = [];

  // Totais
  totalOcorrencias = 0;
  totalAlunosUnicos = 0;
  tipoMaisFrequente = '';
  turmaMaisOcorrencias = '';

  // Rankings
  porTipo: ItemRanking[] = [];
  porTurma: ItemRanking[] = [];
  porAluno: ItemRanking[] = [];
  porProfessor: ItemRanking[] = [];

  // Tendência mensal
  porMes: MesSerie[] = [];

  private MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

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
      await this.processarEstatisticas();
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async processarEstatisticas() {
    const todas = await this.firestoreService.buscarOcorrencias(this.escolaId);
    const ocorrencias = todas.filter(o => o.data?.startsWith(String(this.anoSelecionado)));

    this.totalOcorrencias = ocorrencias.length;
    this.totalAlunosUnicos = new Set(ocorrencias.map(o => o.nomeAluno)).size;

    // Por tipo
    this.porTipo = this.agrupar(ocorrencias, o => o.tipoOcorrencia || 'Sem tipo');

    // Por turma
    this.porTurma = this.agrupar(ocorrencias, o => o.turma || 'Sem turma');

    // Por aluno (top 10)
    this.porAluno = this.agrupar(ocorrencias, o => o.nomeAluno).slice(0, 10);

    // Por professor (top 10)
    this.porProfessor = this.agrupar(ocorrencias, o => o.professorNome || 'Sem professor').slice(0, 10);

    // Por mês
    const contMes = new Array(12).fill(0);
    ocorrencias.forEach(o => {
      const m = parseInt(o.data?.split('-')[1] ?? '0') - 1;
      if (m >= 0 && m < 12) contMes[m]++;
    });
    const maxMes = Math.max(...contMes, 1);
    this.porMes = this.MESES.map((mes, i) => ({
      mes,
      total: contMes[i],
      pct: Math.round((contMes[i] / maxMes) * 100)
    }));

    this.tipoMaisFrequente = this.porTipo[0]?.label ?? '—';
    this.turmaMaisOcorrencias = this.porTurma[0]?.label ?? '—';

    this.cdr.markForCheck();
  }

  private agrupar(ocorrencias: Ocorrencia[], key: (o: Ocorrencia) => string): ItemRanking[] {
    const mapa = new Map<string, number>();
    ocorrencias.forEach(o => {
      const k = key(o);
      mapa.set(k, (mapa.get(k) ?? 0) + 1);
    });
    const sorted = [...mapa.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, total]) => ({ label, total, pct: 0 }));
    const max = sorted[0]?.total ?? 1;
    sorted.forEach(item => item.pct = Math.round((item.total / max) * 100));
    return sorted;
  }

  async onAnoChange() {
    this.loading = true;
    this.cdr.markForCheck();
    await this.processarEstatisticas();
    this.loading = false;
    this.cdr.markForCheck();
  }

  voltar() {
    this.router.navigate(['/dashboard']);
  }
}
