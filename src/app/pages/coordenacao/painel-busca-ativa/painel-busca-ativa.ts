import { Component, inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, Falta, StatusBuscaAtiva, Conversa, Usuario, Escola } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

type FiltroGatilho = 'todos' | 'urgente' | 'alto_indice';
type FiltroStatus = 'todos' | 'sem_contato' | 'pendente' | 'contatado';

interface OficioModalState {
  aberto: boolean;
  carregando: boolean;
  gerandoPDF: boolean;
  aluno: AlunoEmRisco | null;
  conversas: Conversa[];
  nomeEscola: string;
  // Campos editáveis
  numeroOficio: string;
  anoOficio: number;
  dirigente: string;
  diretoria: string;
  responsavel: string;
  dataNascimento: string;
  endereco: string;
  telefone: string;
  nomeDiretor: string;
  cidade: string;
}

interface AlunoEmRisco {
  alunoId: string;
  alunoNome: string;
  turma: string;
  totalFaltas: number;
  faltasConsecutivas: number;   // streak atual de faltas consecutivas
  dataInicioStreak: string;     // YYYY-MM-DD da 1ª falta do episódio atual
  gatilho: 'urgente' | 'alto_indice' | 'ambos';
  nivel: 'atencao' | 'risco';  // baseado nos 38/50 totais
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
  readonly LIMITE_CONSECUTIVAS = 3;

  escolaId = '';
  loading = false;

  anoSelecionado: number = new Date().getFullYear();
  anos: number[] = [];

  // Filtros
  filtroTurma = '';
  filtroGatilho: FiltroGatilho = 'todos';
  filtroStatus: FiltroStatus = 'todos';

  // Dados
  todosAlunos: AlunoEmRisco[] = [];
  alunosFiltrados: AlunoEmRisco[] = [];
  turmas: string[] = [];

  // Resumo
  totalUrgente = 0;
  totalAltoIndice = 0;
  totalSemContato = 0;
  totalPendentes = 0;
  totalContatados = 0;

  // Usuário logado
  private usuarioLogado: Usuario | null = null;

  // Modal do Ofício
  oficio: OficioModalState = {
    aberto: false,
    carregando: false,
    gerandoPDF: false,
    aluno: null,
    conversas: [],
    nomeEscola: '',
    numeroOficio: '',
    anoOficio: new Date().getFullYear(),
    dirigente: '',
    diretoria: '',
    responsavel: '',
    dataNascimento: '',
    endereco: '',
    telefone: '',
    nomeDiretor: '',
    cidade: ''
  };

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
    for (const s of statusList) statusMap.set(s.alunoId, s);

    // Coletar por aluno: total de faltas + todos os registros de presença (para calcular streak)
    const alunoMap = new Map<string, {
      nome: string;
      turma: string;
      faltas: number;
      registros: { data: string; presente: boolean }[];
    }>();

    for (const falta of faltas) {
      if (!falta.data.startsWith(anoStr) || !falta.alunos) continue;
      for (const [alunoId, dados] of Object.entries(falta.alunos)) {
        if (!alunoMap.has(alunoId)) {
          alunoMap.set(alunoId, { nome: dados.alunoNome, turma: falta.turma, faltas: 0, registros: [] });
        }
        const entry = alunoMap.get(alunoId)!;
        entry.registros.push({ data: falta.data, presente: dados.presente });
        if (!dados.presente) entry.faltas++;
      }
    }

    const result: AlunoEmRisco[] = [];
    for (const [alunoId, dados] of alunoMap) {
      // Calcular streak de faltas consecutivas no final do histórico
      dados.registros.sort((a, b) => a.data.localeCompare(b.data));
      let streak = 0;
      let dataInicioStreak = '';
      for (let i = dados.registros.length - 1; i >= 0; i--) {
        if (!dados.registros[i].presente) {
          streak++;
          dataInicioStreak = dados.registros[i].data; // andando para trás → data mais antiga do streak
        } else break;
      }

      const temConsecutivas = streak >= this.LIMITE_CONSECUTIVAS;
      const temAltoIndice = dados.faltas >= this.LIMITE_ATENCAO;

      // Só incluir se algum gatilho for acionado
      if (!temConsecutivas && !temAltoIndice) continue;

      const gatilho: 'urgente' | 'alto_indice' | 'ambos' =
        temConsecutivas && temAltoIndice ? 'ambos' :
        temConsecutivas ? 'urgente' : 'alto_indice';

      const nivel: 'atencao' | 'risco' = dados.faltas > this.LIMITE_FALTAS ? 'risco' : 'atencao';

      result.push({
        alunoId,
        alunoNome: dados.nome,
        turma: dados.turma,
        totalFaltas: dados.faltas,
        faltasConsecutivas: streak,
        dataInicioStreak,
        gatilho,
        nivel,
        status: statusMap.get(alunoId) ?? null,
        mostrarForm: false,
        salvando: false,
        erroForm: '',
        form: { responsavel: '', resultadoContato: 'conversa', notas: '' }
      });
    }

    // Ordenar: ambos → urgente → alto_indice; dentro de cada grupo por faltas desc
    const ordemGatilho = { ambos: 0, urgente: 1, alto_indice: 2 };
    result.sort((a, b) => {
      if (ordemGatilho[a.gatilho] !== ordemGatilho[b.gatilho])
        return ordemGatilho[a.gatilho] - ordemGatilho[b.gatilho];
      return b.totalFaltas - a.totalFaltas;
    });

    this.todosAlunos = result;
    this.turmas = [...new Set(result.map(a => a.turma))].sort();

    this.recalcularResumos();
    this.aplicarFiltros();
  }

  // Retorna true se o último contato registrado é POSTERIOR ao início do streak atual
  // (ou seja, o episódio atual já foi atendido)
  episodioAtendido(aluno: AlunoEmRisco): boolean {
    if (!aluno.status || !aluno.dataInicioStreak) return false;
    const ultimoContato = typeof (aluno.status.ultimoContato as any)?.toDate === 'function'
      ? (aluno.status.ultimoContato as any).toDate()
      : new Date(aluno.status.ultimoContato as any);
    return ultimoContato >= new Date(aluno.dataInicioStreak + 'T00:00:00');
  }

  private recalcularResumos() {
    this.totalUrgente    = this.todosAlunos.filter(a => a.gatilho === 'urgente' || a.gatilho === 'ambos').length;
    this.totalAltoIndice = this.todosAlunos.filter(a => a.gatilho === 'alto_indice' || a.gatilho === 'ambos').length;
    this.totalSemContato = this.todosAlunos.filter(a => !a.status || !this.episodioAtendido(a)).length;
    this.totalPendentes  = this.todosAlunos.filter(a =>
      this.episodioAtendido(a) &&
      (a.status?.resultado === 'nao_conseguiu' || a.status?.resultado === 'ligar_novamente')
    ).length;
    this.totalContatados = this.todosAlunos.filter(a =>
      this.episodioAtendido(a) &&
      (a.status?.resultado === 'conversa' || a.status?.resultado === 'recado')
    ).length;
  }

  aplicarFiltros() {
    let lista = [...this.todosAlunos];

    if (this.filtroTurma) {
      lista = lista.filter(a => a.turma === this.filtroTurma);
    }

    switch (this.filtroGatilho) {
      case 'urgente':
        lista = lista.filter(a => a.gatilho === 'urgente' || a.gatilho === 'ambos');
        break;
      case 'alto_indice':
        lista = lista.filter(a => a.gatilho === 'alto_indice' || a.gatilho === 'ambos');
        break;
    }

    switch (this.filtroStatus) {
      case 'sem_contato':
        lista = lista.filter(a => !a.status || !this.episodioAtendido(a));
        break;
      case 'pendente':
        lista = lista.filter(a =>
          this.episodioAtendido(a) &&
          (a.status?.resultado === 'nao_conseguiu' || a.status?.resultado === 'ligar_novamente')
        );
        break;
      case 'contatado':
        lista = lista.filter(a =>
          this.episodioAtendido(a) &&
          (a.status?.resultado === 'conversa' || a.status?.resultado === 'recado')
        );
        break;
    }

    this.alunosFiltrados = lista;
    this.cdr.markForCheck();
  }

  mudarFiltroGatilho(filtro: FiltroGatilho) {
    this.filtroGatilho = filtro;
    this.aplicarFiltros();
  }

  mudarFiltroStatus(filtro: FiltroStatus) {
    this.filtroStatus = filtro;
    this.aplicarFiltros();
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
      const motivoContato: StatusBuscaAtiva['motivo'] =
        aluno.gatilho === 'ambos'      ? 'ambos' :
        aluno.gatilho === 'urgente'    ? 'consecutivas' : 'alto_indice';

      await this.firestoreService.registrarStatusBuscaAtiva(this.escolaId, {
        escolaId: this.escolaId,
        alunoId: aluno.alunoId,
        alunoNome: aluno.alunoNome,
        ultimoContato: now,
        resultado: aluno.form.resultadoContato,
        motivo: motivoContato,
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
        motivo: motivoContato,
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

  async abrirModalOficio(aluno: AlunoEmRisco) {
    this.oficio = {
      ...this.oficio,
      aberto: true,
      carregando: true,
      aluno,
      conversas: [],
      nomeEscola: '',
      gerandoPDF: false,
      numeroOficio: '',
      anoOficio: new Date().getFullYear()
    };
    this.cdr.markForCheck();

    try {
      const [conversas, escola] = await Promise.all([
        this.firestoreService.obterConversas(this.escolaId, aluno.alunoId),
        this.firestoreService.buscarEscola(this.escolaId)
      ]);
      conversas.sort((a, b) => {
        const da = a.registradoEm ? new Date(a.registradoEm).getTime() : 0;
        const db = b.registradoEm ? new Date(b.registradoEm).getTime() : 0;
        return da - db;
      });
      this.oficio.conversas = conversas;
      this.oficio.nomeEscola = escola?.nome ?? '';
    } catch (err) {
      console.error('Erro ao carregar dados para ofício:', err);
    } finally {
      this.oficio.carregando = false;
      this.cdr.markForCheck();
    }
  }

  fecharModalOficio() {
    this.oficio.aberto = false;
    this.cdr.markForCheck();
  }

  async gerarOficioPDF() {
    if (!this.oficio.aluno) return;
    this.oficio.gerandoPDF = true;
    this.cdr.markForCheck();

    try {
      const pdfMake = await import('pdfmake/build/pdfmake');
      const pdfFonts = await import('pdfmake/build/vfs_fonts');
      (pdfMake as any).default.vfs = (pdfFonts as any).default;

      const aluno = this.oficio.aluno;
      const hoje = new Date();
      const dataFormatada = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

      const resultadoLabel: Record<string, string> = {
        conversa: 'Conversa realizada',
        recado: 'Deixou recado',
        ligar_novamente: 'Ligar novamente',
        nao_conseguiu: 'Não conseguiu contato'
      };

      const historicoRows: any[][] = this.oficio.conversas.map(c => {
        const dt = c.registradoEm ? new Date(c.registradoEm).toLocaleDateString('pt-BR') : '—';
        return [
          { text: dt, fontSize: 9 },
          { text: c.responsavel || '—', fontSize: 9 },
          { text: resultadoLabel[c.resultadoContato] ?? c.resultadoContato, fontSize: 9 },
          { text: c.notas || '—', fontSize: 9 }
        ];
      });

      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [50, 50, 50, 50],
        styles: {
          titulo: { fontSize: 13, bold: true, alignment: 'center' },
          subtitulo: { fontSize: 10, alignment: 'center', color: '#4B5563' },
          secao: { fontSize: 9.5, bold: true, margin: [0, 14, 0, 4], color: '#374151', decoration: 'underline' },
          corpo: { fontSize: 9.5, lineHeight: 1.4 }
        },
        content: [
          { text: this.oficio.nomeEscola || 'ESCOLA', style: 'titulo' },
          { text: 'Ofício de Busca Ativa Escolar', style: 'subtitulo', margin: [0, 2, 0, 0] },
          { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 495, y2: 4, lineWidth: 0.8, lineColor: '#CBD5E1' }], margin: [0, 6, 0, 14] },
          {
            columns: [
              { text: `OFÍCIO Nº ${this.oficio.numeroOficio || '____'}/${this.oficio.anoOficio}`, fontSize: 10, bold: true },
              { text: `${this.oficio.cidade || '____________'}, ${dataFormatada}`, fontSize: 9, alignment: 'right', color: '#4B5563' }
            ],
            margin: [0, 0, 0, 16]
          },
          { text: 'À/Ao:', style: 'corpo', bold: true },
          { text: this.oficio.dirigente || 'Dirigente Regional', style: 'corpo', margin: [12, 2, 0, 2] },
          { text: `Diretoria de Ensino: ${this.oficio.diretoria || '____________________'}`, style: 'corpo', margin: [12, 0, 0, 16] },
          {
            text: [
              { text: this.oficio.nomeEscola || 'Esta Unidade Escolar', bold: true },
              { text: ', por meio deste ofício, comunica a situação de frequência escolar do(a) aluno(a) abaixo identificado(a), em atendimento às normas de Busca Ativa Escolar.' }
            ],
            style: 'corpo',
            margin: [0, 0, 0, 4]
          },
          { text: 'I – IDENTIFICAÇÃO DO(A) ALUNO(A)', style: 'secao' },
          {
            table: {
              widths: ['*', '*'],
              body: [
                [
                  { stack: [{ text: 'Aluno(a)', fontSize: 7.5, color: '#64748B' }, { text: aluno.alunoNome, fontSize: 9.5 }], border: [false, false, false, true], borderColor: [null, null, null, '#CBD5E1'], margin: [2, 0, 2, 4] },
                  { stack: [{ text: 'Turma / Série', fontSize: 7.5, color: '#64748B' }, { text: aluno.turma, fontSize: 9.5 }], border: [false, false, false, true], borderColor: [null, null, null, '#CBD5E1'], margin: [2, 0, 2, 4] }
                ],
                [
                  { stack: [{ text: 'Data de Nascimento', fontSize: 7.5, color: '#64748B' }, { text: this.oficio.dataNascimento || '—', fontSize: 9.5 }], border: [false, false, false, true], borderColor: [null, null, null, '#CBD5E1'], margin: [2, 0, 2, 4] },
                  { stack: [{ text: 'Responsável(eis)', fontSize: 7.5, color: '#64748B' }, { text: this.oficio.responsavel || '—', fontSize: 9.5 }], border: [false, false, false, true], borderColor: [null, null, null, '#CBD5E1'], margin: [2, 0, 2, 4] }
                ],
                [
                  { stack: [{ text: 'Endereço', fontSize: 7.5, color: '#64748B' }, { text: this.oficio.endereco || '—', fontSize: 9.5 }], border: [false, false, false, true], borderColor: [null, null, null, '#CBD5E1'], margin: [2, 0, 2, 4] },
                  { stack: [{ text: 'Telefone(s)', fontSize: 7.5, color: '#64748B' }, { text: this.oficio.telefone || '—', fontSize: 9.5 }], border: [false, false, false, true], borderColor: [null, null, null, '#CBD5E1'], margin: [2, 0, 2, 4] }
                ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 4]
          },
          { text: 'II – SITUAÇÃO DE FREQUÊNCIA', style: 'secao' },
          {
            ul: [
              { text: [`Total de faltas no ano letivo de ${this.oficio.anoOficio}: `, { text: `${aluno.totalFaltas} dias`, bold: true }], style: 'corpo' },
              { text: ['Faltas consecutivas (episódio atual): ', { text: `${aluno.faltasConsecutivas} dias`, bold: true }], style: 'corpo' },
              { text: ['Percentual de absenteísmo: ', { text: `${((aluno.totalFaltas / 200) * 100).toFixed(1)}%`, bold: true }], style: 'corpo' }
            ],
            margin: [0, 0, 0, 4]
          },
          { text: 'III – HISTÓRICO DE AÇÕES DE BUSCA ATIVA', style: 'secao' },
          ...(historicoRows.length > 0
            ? [{
                table: {
                  headerRows: 1,
                  widths: [55, 100, 120, '*'],
                  body: [
                    [
                      { text: 'Data', bold: true, fillColor: '#F1F5F9', fontSize: 9 },
                      { text: 'Contato com', bold: true, fillColor: '#F1F5F9', fontSize: 9 },
                      { text: 'Resultado', bold: true, fillColor: '#F1F5F9', fontSize: 9 },
                      { text: 'Observações', bold: true, fillColor: '#F1F5F9', fontSize: 9 }
                    ],
                    ...historicoRows
                  ]
                },
                margin: [0, 0, 0, 4]
              }]
            : [{ text: 'Nenhum registro de contato anterior encontrado.', style: 'corpo', italics: true, color: '#6B7280', margin: [0, 0, 0, 4] }]
          ),
          {
            text: 'Diante do exposto, solicitamos as devidas providências para garantir o retorno do(a) aluno(a) à escola e assegurar seu direito à educação.',
            style: 'corpo',
            margin: [0, 16, 0, 50]
          },
          { canvas: [{ type: 'line', x1: 140, y1: 0, x2: 355, y2: 0, lineWidth: 0.8, lineColor: '#374151' }] },
          { text: this.oficio.nomeDiretor || 'Nome do(a) Diretor(a)', alignment: 'center', bold: true, fontSize: 10, margin: [0, 4, 0, 0] },
          { text: 'Diretor(a) Escolar', alignment: 'center', fontSize: 9, color: '#6B7280' }
        ]
      };

      const nomeArquivo = `Oficio-BuscaAtiva-${aluno.alunoNome.replace(/\s+/g, '-')}-${this.oficio.anoOficio}.pdf`;
      (pdfMake as any).default.createPdf(docDefinition).download(nomeArquivo);
    } catch (err) {
      console.error('Erro ao gerar PDF do ofício:', err);
    } finally {
      this.oficio.gerandoPDF = false;
      this.cdr.markForCheck();
    }
  }
}
