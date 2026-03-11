import { Component, inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, Aluno, Ocorrencia, Falta, Conversa, Usuario } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

interface DadosFicha {
  aluno: Aluno;
  // Frequência
  totalFaltas: number;
  percentualPresenca: number;
  nivel: 'ok' | 'atencao' | 'risco';
  // Ocorrências
  ocorrencias: Ocorrencia[];
  totalOcorrencias: number;
  tiposMaisFrequentes: { tipo: string; total: number }[];
  // Contatos
  conversas: Conversa[];
}

@Component({
  selector: 'app-ficha-aluno',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ficha-aluno.html',
  styleUrl: './ficha-aluno.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FichaAluno implements OnInit {

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  readonly DIAS_LETIVOS = 200;
  readonly LIMITE_FALTAS = 50;
  readonly LIMITE_ATENCAO = 38;

  escolaId = '';
  loading = false;
  loadingFicha = false;

  // Busca
  termoBusca = '';
  todosAlunos: Aluno[] = [];
  alunosFiltrados: Aluno[] = [];
  mostrarSugestoes = false;

  // Ficha selecionada
  ficha: DadosFicha | null = null;
  ocorrenciaExpandida: string | null = null;

  // Filtro de ano
  anoSelecionado: number = new Date().getFullYear();
  anos: number[] = [];

  // Usuário logado (para registrar contatos)
  private usuarioLogado: Usuario | null = null;

  // Formulário de novo contato
  mostrarFormContato = false;
  salvandoContato = false;
  erroContato = '';
  formContato = {
    responsavel: '',
    resultadoContato: 'conversa' as Conversa['resultadoContato'],
    notas: ''
  };

  readonly opcoesResultado: { valor: Conversa['resultadoContato']; label: string; icone: string }[] = [
    { valor: 'conversa',        label: 'Conversa realizada',    icone: '✅' },
    { valor: 'recado',          label: 'Deixou recado',         icone: '📝' },
    { valor: 'ligar_novamente', label: 'Ligar novamente',       icone: '🔁' },
    { valor: 'nao_conseguiu',   label: 'Não conseguiu contato', icone: '❌' },
  ];

  // Cache de dados brutos (recarregado apenas ao mudar ano)
  private todasFaltas: Falta[] = [];
  private todasOcorrencias: Ocorrencia[] = [];

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

      const [alunos, faltas, ocorrencias] = await Promise.all([
        this.firestoreService.obterAlunos(this.escolaId),
        this.firestoreService.obterFaltasPorEscola(this.escolaId),
        this.firestoreService.buscarOcorrencias(this.escolaId)
      ]);

      this.todosAlunos = alunos;
      this.todasFaltas = faltas;
      this.todasOcorrencias = ocorrencias;
      this.usuarioLogado = usuario;

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async onAnoChange() {
    this.loading = true;
    this.ficha = null;
    this.cdr.markForCheck();

    try {
      const [faltas, ocorrencias] = await Promise.all([
        this.firestoreService.obterFaltasPorEscola(this.escolaId),
        this.firestoreService.buscarOcorrencias(this.escolaId)
      ]);
      this.todasFaltas = faltas;
      this.todasOcorrencias = ocorrencias;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  onBuscaInput() {
    const termo = this.termoBusca.trim().toLowerCase();
    if (termo.length < 2) {
      this.alunosFiltrados = [];
      this.mostrarSugestoes = false;
      this.cdr.markForCheck();
      return;
    }
    this.alunosFiltrados = this.todosAlunos
      .filter(a => a.nome.toLowerCase().includes(termo))
      .slice(0, 8);
    this.mostrarSugestoes = this.alunosFiltrados.length > 0;
    this.cdr.markForCheck();
  }

  async selecionarAluno(aluno: Aluno) {
    this.termoBusca = aluno.nome;
    this.mostrarSugestoes = false;
    this.alunosFiltrados = [];
    this.ocorrenciaExpandida = null;
    this.mostrarFormContato = false;
    this.erroContato = '';

    this.loadingFicha = true;
    this.ficha = null;
    this.cdr.markForCheck();

    try {
      const conversas = aluno.id
        ? await this.firestoreService.obterConversas(this.escolaId, aluno.id)
        : [];
      // Ordem mais recente primeiro
      conversas.sort((a, b) => b.registradoEm.getTime() - a.registradoEm.getTime());
      this.ficha = this.montarFicha(aluno, conversas);
    } finally {
      this.loadingFicha = false;
      this.cdr.markForCheck();
    }
  }

  private montarFicha(aluno: Aluno, conversas: Conversa[] = []): DadosFicha {
    const anoStr = String(this.anoSelecionado);

    // --- Frequência ---
    const faltasDoAno = this.todasFaltas.filter(
      f => f.turma === aluno.turma && f.data.startsWith(anoStr)
    );

    let totalFaltas = 0;
    for (const registro of faltasDoAno) {
      if (!registro.alunos) continue;
      const dado = Object.entries(registro.alunos).find(
        ([id, d]) => id === aluno.id || d.alunoNome === aluno.nome
      );
      if (dado && !dado[1].presente) {
        totalFaltas++;
      }
    }

    const pct = Math.round(Math.max(((this.DIAS_LETIVOS - totalFaltas) / this.DIAS_LETIVOS) * 1000, 0)) / 10;
    const nivel: 'ok' | 'atencao' | 'risco' =
      totalFaltas > this.LIMITE_FALTAS ? 'risco' :
      totalFaltas >= this.LIMITE_ATENCAO ? 'atencao' : 'ok';

    // --- Ocorrências ---
    const nomeLower = aluno.nome.toLowerCase();
    const ocorrencias = this.todasOcorrencias
      .filter(o =>
        o.nomeAluno?.toLowerCase() === nomeLower &&
        o.data?.startsWith(anoStr)
      )
      .sort((a, b) => b.data.localeCompare(a.data));

    // Top tipos
    const tiposMap = new Map<string, number>();
    for (const o of ocorrencias) {
      tiposMap.set(o.tipoOcorrencia, (tiposMap.get(o.tipoOcorrencia) ?? 0) + 1);
    }
    const tiposMaisFrequentes = Array.from(tiposMap.entries())
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return {
      aluno,
      totalFaltas,
      percentualPresenca: pct,
      nivel,
      ocorrencias,
      totalOcorrencias: ocorrencias.length,
      tiposMaisFrequentes,
      conversas
    };
  }

  // ── Contato com responsável ──────────────────────────────

  toggleFormContato() {
    this.mostrarFormContato = !this.mostrarFormContato;
    if (this.mostrarFormContato) {
      this.formContato = { responsavel: '', resultadoContato: 'conversa', notas: '' };
      this.erroContato = '';
    }
    this.cdr.markForCheck();
  }

  async salvarContato() {
    if (!this.ficha || !this.ficha.aluno.id) return;
    if (!this.formContato.responsavel.trim()) {
      this.erroContato = 'Informe o nome do responsável.';
      this.cdr.markForCheck();
      return;
    }

    this.salvandoContato = true;
    this.erroContato = '';
    this.cdr.markForCheck();

    try {
      const user = this.authService.getCurrentUser();
      await this.firestoreService.salvarConversa(this.escolaId, {
        alunoId: this.ficha.aluno.id!,
        alunoNome: this.ficha.aluno.nome,
        responsavel: this.formContato.responsavel.trim(),
        resultadoContato: this.formContato.resultadoContato,
        notas: this.formContato.notas.trim(),
        registradoEm: new Date(),
        registradoPor: user?.uid ?? '',
        registradoPorNome: this.usuarioLogado?.nome ?? ''
      });

      // Recarregar conversas e atualizar ficha sem perder o estado
      const conversas = await this.firestoreService.obterConversas(this.escolaId, this.ficha.aluno.id!);
      conversas.sort((a, b) => b.registradoEm.getTime() - a.registradoEm.getTime());
      this.ficha = { ...this.ficha, conversas };
      this.mostrarFormContato = false;
    } catch (err) {
      console.error('Erro ao salvar contato:', err);
      this.erroContato = 'Erro ao salvar. Tente novamente.';
    } finally {
      this.salvandoContato = false;
      this.cdr.markForCheck();
    }
  }

  getLabelResultado(resultado: Conversa['resultadoContato']): string {
    return this.opcoesResultado.find(o => o.valor === resultado)?.label ?? resultado;
  }

  getIconeResultado(resultado: Conversa['resultadoContato']): string {
    return this.opcoesResultado.find(o => o.valor === resultado)?.icone ?? '';
  }

  fecharSugestoes() {
    // Delay para permitir click nas sugestões antes de fechar
    setTimeout(() => {
      this.mostrarSugestoes = false;
      this.cdr.markForCheck();
    }, 200);
  }

  toggleOcorrencia(id: string) {
    this.ocorrenciaExpandida = this.ocorrenciaExpandida === id ? null : id;
    this.cdr.markForCheck();
  }

  limparBusca() {
    this.termoBusca = '';
    this.ficha = null;
    this.alunosFiltrados = [];
    this.mostrarSugestoes = false;
    this.cdr.markForCheck();
  }

  getNivelLabel(nivel: string): string {
    return nivel === 'risco' ? 'Reprovado por Falta' :
           nivel === 'atencao' ? 'Em Atenção' : 'Regular';
  }

  getPresencaBarWidth(): number {
    if (!this.ficha) return 0;
    return Math.min(this.ficha.percentualPresenca, 100);
  }

  getLimiteFaltasWidth(): number {
    if (!this.ficha) return 0;
    return Math.min((this.ficha.totalFaltas / this.LIMITE_FALTAS) * 100, 100);
  }

  voltar() {
    this.router.navigate(['/dashboard']);
  }
}
