import { Component, inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, Falta, StatusBuscaAtiva, Conversa, Usuario } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

type FiltroStatus = 'todos' | 'sem_contato' | 'pendente' | 'contatado';

interface AlunoEmRisco {
  alunoId: string;
  alunoNome: string;
  turma: string;
  totalFaltas: number;
  nivel: 'atencao' | 'risco';
  // Status de busca ativa
  status: StatusBuscaAtiva | null;
  // Controle UI
  mostrarForm: boolean;
  salvando: boolean;
  erroForm: string;
  form: {
    responsavel: string;
    resultadoContato: Conversa['resultadoContato'];
    notas: string;
  };
}

@Component({
  selector: 'app-painel-busca-ativa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './painel-busca-ativa.html',
  styleUrl: './painel-busca-ativa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PainelBuscaAtiva implements OnInit {

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  readonly DIAS_LETIVOS = 200;
  readonly LIMITE_FALTAS = 50;
  readonly LIMITE_ATENCAO = 38;

  escolaId = '';
  loading = false;

  anoSelecionado: number = new Date().getFullYear();
  anos: number[] = [];

  // Filtros
  filtroTurma = '';
  filtroStatus: FiltroStatus = 'todos';

  // Dados
  todosAlunos: AlunoEmRisco[] = [];
  alunosFiltrados: AlunoEmRisco[] = [];
  turmas: string[] = [];

  // Resumo
  totalSemContato = 0;
  totalPendentes = 0;
  totalContatados = 0;

  // Usuário logado
  private usuarioLogado: Usuario | null = null;

  readonly opcoesResultado: { valor: Conversa['resultadoContato']; label: string; icone: string }[] = [
    { valor: 'conversa',        label: 'Conversa realizada',    icone: '✅' },
    { valor: 'recado',          label: 'Deixou recado',         icone: '📝' },
    { valor: 'ligar_novamente', label: 'Ligar novamente',       icone: '🔁' },
    { valor: 'nao_conseguiu',   label: 'Não conseguiu contato', icone: '❌' },
  ];

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
      this.usuarioLogado = usuario;

      const [faltas, statusList] = await Promise.all([
        this.firestoreService.obterFaltasPorEscola(this.escolaId),
        this.firestoreService.obterTodosBuscaAtiva(this.escolaId)
      ]);

      this.processarDados(faltas, statusList);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async onAnoChange() {
    this.loading = true;
    this.cdr.markForCheck();
    const [faltas, statusList] = await Promise.all([
      this.firestoreService.obterFaltasPorEscola(this.escolaId),
      this.firestoreService.obterTodosBuscaAtiva(this.escolaId)
    ]);
    this.processarDados(faltas, statusList);
    this.loading = false;
    this.cdr.markForCheck();
  }

  private processarDados(faltas: Falta[], statusList: StatusBuscaAtiva[]) {
    const anoStr = String(this.anoSelecionado);

    // Mapa alunoId → StatusBuscaAtiva
    const statusMap = new Map<string, StatusBuscaAtiva>();
    for (const s of statusList) {
      statusMap.set(s.alunoId, s);
    }

    // Contar faltas por aluno
    const alunoMap = new Map<string, { nome: string; turma: string; faltas: number }>();

    for (const falta of faltas) {
      if (!falta.data.startsWith(anoStr) || !falta.alunos) continue;
      for (const [alunoId, dados] of Object.entries(falta.alunos)) {
        if (!alunoMap.has(alunoId)) {
          alunoMap.set(alunoId, { nome: dados.alunoNome, turma: falta.turma, faltas: 0 });
        }
        if (!dados.presente) {
          alunoMap.get(alunoId)!.faltas++;
        }
      }
    }

    // Filtrar apenas alunos em atenção ou risco
    const result: AlunoEmRisco[] = [];
    for (const [alunoId, dados] of alunoMap) {
      if (dados.faltas < this.LIMITE_ATENCAO) continue;

      const nivel: 'atencao' | 'risco' = dados.faltas > this.LIMITE_FALTAS ? 'risco' : 'atencao';
      result.push({
        alunoId,
        alunoNome: dados.nome,
        turma: dados.turma,
        totalFaltas: dados.faltas,
        nivel,
        status: statusMap.get(alunoId) ?? null,
        mostrarForm: false,
        salvando: false,
        erroForm: '',
        form: { responsavel: '', resultadoContato: 'conversa', notas: '' }
      });
    }

    // Ordenar: risco primeiro, depois por faltas desc
    result.sort((a, b) => {
      if (a.nivel !== b.nivel) return a.nivel === 'risco' ? -1 : 1;
      return b.totalFaltas - a.totalFaltas;
    });

    this.todosAlunos = result;
    this.turmas = [...new Set(result.map(a => a.turma))].sort();

    this.recalcularResumos();
    this.aplicarFiltros();
  }

  private recalcularResumos() {
    this.totalSemContato = this.todosAlunos.filter(a => !a.status).length;
    this.totalPendentes = this.todosAlunos.filter(a =>
      a.status?.resultado === 'nao_conseguiu' || a.status?.resultado === 'ligar_novamente'
    ).length;
    this.totalContatados = this.todosAlunos.filter(a =>
      a.status?.resultado === 'conversa' || a.status?.resultado === 'recado'
    ).length;
  }

  aplicarFiltros() {
    let lista = [...this.todosAlunos];

    if (this.filtroTurma) {
      lista = lista.filter(a => a.turma === this.filtroTurma);
    }

    switch (this.filtroStatus) {
      case 'sem_contato':
        lista = lista.filter(a => !a.status);
        break;
      case 'pendente':
        lista = lista.filter(a =>
          a.status?.resultado === 'nao_conseguiu' || a.status?.resultado === 'ligar_novamente'
        );
        break;
      case 'contatado':
        lista = lista.filter(a =>
          a.status?.resultado === 'conversa' || a.status?.resultado === 'recado'
        );
        break;
    }

    this.alunosFiltrados = lista;
    this.cdr.markForCheck();
  }

  toggleForm(aluno: AlunoEmRisco) {
    aluno.mostrarForm = !aluno.mostrarForm;
    if (aluno.mostrarForm) {
      aluno.form = { responsavel: '', resultadoContato: 'conversa', notas: '' };
      aluno.erroForm = '';
    }
    this.cdr.markForCheck();
  }

  async salvarContato(aluno: AlunoEmRisco) {
    if (!aluno.form.responsavel.trim()) {
      aluno.erroForm = 'Informe o nome do responsável.';
      this.cdr.markForCheck();
      return;
    }

    aluno.salvando = true;
    aluno.erroForm = '';
    this.cdr.markForCheck();

    try {
      const user = this.authService.getCurrentUser();
      const now = new Date();

      // Salvar no histórico de conversas (ficha do aluno)
      await this.firestoreService.salvarConversa(this.escolaId, {
        alunoId: aluno.alunoId,
        alunoNome: aluno.alunoNome,
        responsavel: aluno.form.responsavel.trim(),
        resultadoContato: aluno.form.resultadoContato,
        notas: aluno.form.notas.trim(),
        registradoEm: now,
        registradoPor: user?.uid ?? '',
        registradoPorNome: this.usuarioLogado?.nome ?? ''
      });

      // Atualizar status de busca ativa (upsert)
      await this.firestoreService.registrarStatusBuscaAtiva(this.escolaId, {
        escolaId: this.escolaId,
        alunoId: aluno.alunoId,
        alunoNome: aluno.alunoNome,
        ultimoContato: now,
        resultado: aluno.form.resultadoContato,
        registradoPor: user?.uid ?? '',
        registradoPorNome: this.usuarioLogado?.nome ?? ''
      });

      // Atualizar status localmente sem re-buscar tudo
      aluno.status = {
        escolaId: this.escolaId,
        alunoId: aluno.alunoId,
        alunoNome: aluno.alunoNome,
        ultimoContato: now,
        resultado: aluno.form.resultadoContato,
        registradoPor: user?.uid ?? '',
        registradoPorNome: this.usuarioLogado?.nome ?? ''
      };
      aluno.mostrarForm = false;

      this.recalcularResumos();
      this.aplicarFiltros();

    } catch (err) {
      console.error('Erro ao salvar contato:', err);
      aluno.erroForm = 'Erro ao salvar. Tente novamente.';
    } finally {
      aluno.salvando = false;
      this.cdr.markForCheck();
    }
  }

  verFicha(aluno: AlunoEmRisco) {
    // Navega para ficha pré-buscando o aluno pelo nome via queryParam
    this.router.navigate(['/coordenacao/ficha-aluno'], {
      queryParams: { nome: aluno.alunoNome }
    });
  }

  getIconeResultado(resultado: Conversa['resultadoContato']): string {
    return this.opcoesResultado.find(o => o.valor === resultado)?.icone ?? '';
  }

  getLabelResultado(resultado: Conversa['resultadoContato']): string {
    return this.opcoesResultado.find(o => o.valor === resultado)?.label ?? resultado;
  }

  getDiasDesdeContato(data: Date): string {
    if (!data) return '';
    const diff = Math.floor((Date.now() - data.getTime()) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    return `${diff} dias atrás`;
  }

  voltar() {
    this.router.navigate(['/dashboard']);
  }
}
