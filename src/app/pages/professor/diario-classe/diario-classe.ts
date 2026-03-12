import { Component, inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, DiarioEntrada, HorarioLinha, HorarioSemana, Usuario } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

interface GrupoMes {
  label: string;
  mes: string;
  entradas: DiarioEntrada[];
}

interface HorarioEstado {
  id: string | null;
  nome: string;
  linhas: HorarioLinha[];
  editando: boolean;
  salvando: boolean;
  _backup: HorarioLinha[] | null;
  _nomeBackup: string;
}

const RECURSOS_OPCOES = [
  { valor: 'livro',        icone: '📚', label: 'Livro didático' },
  { valor: 'projetor',     icone: '🖥️', label: 'Projetor' },
  { valor: 'atividade',    icone: '📝', label: 'Atividade' },
  { valor: 'avaliacao',    icone: '✏️',  label: 'Avaliação/Prova' },
  { valor: 'revisao',      icone: '🔁', label: 'Revisão' },
  { valor: 'video',        icone: '🎬', label: 'Vídeo' },
  { valor: 'debate',       icone: '💬', label: 'Debate' },
  { valor: 'laboratorio',  icone: '🔬', label: 'Laboratório' },
];

const DISCIPLINAS_OPCOES = [
  'Arte', 'Biologia', 'Ciências', 'Educação Física',
  'Ensino Religioso', 'Filosofia', 'Física', 'Geografia',
  'História', 'Inglês', 'Informática', 'Língua Portuguesa',
  'Literatura', 'Matemática', 'Química', 'Redação', 'Sociologia'
];

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

@Component({
  selector: 'app-diario-classe',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diario-classe.html',
  styleUrl: './diario-classe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiarioClasse implements OnInit {

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loading = false;
  salvando = false;
  escolaId = '';
  professorId = '';
  professorNome = '';

  todasEntradas: DiarioEntrada[] = [];
  gruposMes: GrupoMes[] = [];
  turmasUsadas: string[] = [];

  filtroTurma = '';
  filtroMes = '';

  modalAberto = false;
  editandoId: string | null = null;
  erroForm = '';

  form = {
    data: new Date().toISOString().substring(0, 10),
    turma: '',
    disciplina: '',
    numeroAula: null as number | null,
    conteudo: '',
    observacao: '',
    recursos: [] as string[]
  };

  readonly RECURSOS_OPCOES = RECURSOS_OPCOES;
  readonly DISCIPLINAS_OPCOES = DISCIPLINAS_OPCOES;
  readonly anoAtual = new Date().getFullYear();

  // ── Horário semanal ──
  paginaAtiva: 'registros' | 'horario' = 'registros';
  horarios: HorarioEstado[] = [];
  horarioCarregado = false;

  readonly DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex'] as const;
  readonly DIAS_LABELS: Record<string, string> = {
    seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta'
  };
  readonly HORARIOS_PADRAO = [
    '07:00', '07:50', '08:40', '09:30 / 09:50', '10:40', '11:30',
    '13:00', '13:50', '14:40', '15:30 / 15:50', '16:40', '17:30'
  ];

  ngOnInit() {
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
      this.professorId = user.uid;
      this.professorNome = usuario.nome;

      const entradas = await this.firestoreService.obterDiarioEntradas(this.escolaId, this.professorId);
      this.todasEntradas = entradas;
      this.turmasUsadas = [...new Set(entradas.map(e => e.turma))].sort();
      this.agrupar();

    } catch (err) {
      console.error('Erro ao carregar diário:', err);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  agrupar() {
    let lista = [...this.todasEntradas];

    if (this.filtroTurma) lista = lista.filter(e => e.turma === this.filtroTurma);
    if (this.filtroMes)   lista = lista.filter(e => e.data.startsWith(this.filtroMes));

    const grupos = new Map<string, DiarioEntrada[]>();
    for (const e of lista) {
      const mes = e.data.substring(0, 7);
      if (!grupos.has(mes)) grupos.set(mes, []);
      grupos.get(mes)!.push(e);
    }

    this.gruposMes = [...grupos.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, entradas]) => ({
        label: this.formatarMes(mes),
        mes,
        entradas: entradas.sort((a, b) => b.data.localeCompare(a.data))
      }));

    this.cdr.markForCheck();
  }

  formatarMes(mes: string): string {
    const [ano, m] = mes.split('-');
    return `${MESES[parseInt(m, 10) - 1]} ${ano}`;
  }

  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  formatarDiaSemana(data: string): string {
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return dias[new Date(data + 'T12:00:00').getDay()];
  }

  getMesesLista(): string[] {
    return [...new Set(this.todasEntradas.map(e => e.data.substring(0, 7)))]
      .sort((a, b) => b.localeCompare(a));
  }

  abrirModalNovo() {
    this.editandoId = null;
    this.form = {
      data: new Date().toISOString().substring(0, 10),
      turma: this.filtroTurma || '',
      disciplina: '',
      numeroAula: null,
      conteudo: '',
      observacao: '',
      recursos: []
    };
    this.erroForm = '';
    this.modalAberto = true;
    this.cdr.markForCheck();
  }

  abrirModalEditar(entrada: DiarioEntrada) {
    this.editandoId = entrada.id ?? null;
    this.form = {
      data: entrada.data,
      turma: entrada.turma,
      disciplina: entrada.disciplina,
      numeroAula: entrada.numeroAula ?? null,
      conteudo: entrada.conteudo,
      observacao: entrada.observacao ?? '',
      recursos: [...(entrada.recursos ?? [])]
    };
    this.erroForm = '';
    this.modalAberto = true;
    this.cdr.markForCheck();
  }

  fecharModal() {
    this.modalAberto = false;
    this.cdr.markForCheck();
  }

  toggleRecurso(valor: string) {
    const idx = this.form.recursos.indexOf(valor);
    if (idx >= 0) this.form.recursos.splice(idx, 1);
    else this.form.recursos.push(valor);
  }

  recursoSelecionado(valor: string): boolean {
    return this.form.recursos.includes(valor);
  }

  async salvar() {
    if (!this.form.data || !this.form.turma.trim() || !this.form.disciplina.trim() || !this.form.conteudo.trim()) {
      this.erroForm = 'Preencha data, turma, disciplina e conteúdo.';
      this.cdr.markForCheck();
      return;
    }

    this.salvando = true;
    this.erroForm = '';
    this.cdr.markForCheck();

    try {
      const obs = this.form.observacao.trim();
      const dados: Omit<DiarioEntrada, 'id'> = {
        escolaId: this.escolaId,
        professorId: this.professorId,
        professorNome: this.professorNome,
        turma: this.form.turma.trim(),
        disciplina: this.form.disciplina.trim(),
        data: this.form.data,
        ...(this.form.numeroAula != null ? { numeroAula: this.form.numeroAula } : {}),
        conteudo: this.form.conteudo.trim(),
        observacao: obs,
        recursos: this.form.recursos,
        registradoEm: new Date()
      };

      if (this.editandoId) {
        await this.firestoreService.atualizarDiarioEntrada(this.editandoId, dados);
        const idx = this.todasEntradas.findIndex(e => e.id === this.editandoId);
        if (idx >= 0) this.todasEntradas[idx] = { ...dados, id: this.editandoId };
      } else {
        const id = await this.firestoreService.salvarDiarioEntrada(dados);
        this.todasEntradas.push({ ...dados, id });
      }

      this.turmasUsadas = [...new Set(this.todasEntradas.map(e => e.turma))].sort();
      this.agrupar();
      this.fecharModal();

    } catch (err) {
      console.error('Erro ao salvar:', err);
      this.erroForm = 'Erro ao salvar. Tente novamente.';
    } finally {
      this.salvando = false;
      this.cdr.markForCheck();
    }
  }

  async excluir(entrada: DiarioEntrada) {
    if (!entrada.id) return;
    if (!confirm(`Excluir registro de ${this.formatarData(entrada.data)} — ${entrada.turma}?`)) return;
    try {
      await this.firestoreService.excluirDiarioEntrada(entrada.id);
      this.todasEntradas = this.todasEntradas.filter(e => e.id !== entrada.id);
      this.agrupar();
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  }

  getRecursoIcone(valor: string): string {
    return RECURSOS_OPCOES.find(r => r.valor === valor)?.icone ?? '•';
  }

  getRecursoLabel(valor: string): string {
    return RECURSOS_OPCOES.find(r => r.valor === valor)?.label ?? valor;
  }

  abrirLousa() {
    this.router.navigate(['/professor/lousa']);
  }

  voltar() {
    this.router.navigate(['/dashboard']);
  }

  // ── Horário semanal ──────────────────────────────────────────────────────

  async abrirHorario() {
    this.paginaAtiva = 'horario';
    if (!this.horarioCarregado) await this.carregarHorarios();
  }

  async carregarHorarios() {
    const lista = await this.firestoreService.obterTodosHorariosDosProfessor(this.professorId);
    this.horarios = lista.map(h => ({
      id: h.id ?? null,
      nome: h.nome ?? '',
      linhas: h.linhas,
      editando: false,
      salvando: false,
      _backup: null,
      _nomeBackup: ''
    }));
    this.horarioCarregado = true;
    this.cdr.markForCheck();
  }

  adicionarNovoHorario() {
    const linhas = this.HORARIOS_PADRAO.slice(0, 6).map(horario => ({
      horario, seg: '', ter: '', qua: '', qui: '', sex: ''
    }));
    this.horarios = [...this.horarios, {
      id: null,
      nome: '',
      linhas,
      editando: true,
      salvando: false,
      _backup: null,
      _nomeBackup: ''
    }];
    this.cdr.markForCheck();
  }

  iniciarEdicaoHorario(h: HorarioEstado) {
    h._backup = h.linhas.map(l => ({ ...l }));
    h._nomeBackup = h.nome;
    h.editando = true;
    this.cdr.markForCheck();
  }

  cancelarEdicaoHorario(h: HorarioEstado) {
    if (h.id === null) {
      this.horarios = this.horarios.filter(x => x !== h);
    } else {
      if (h._backup) h.linhas = h._backup;
      h.nome = h._nomeBackup;
      h._backup = null;
      h.editando = false;
    }
    this.cdr.markForCheck();
  }

  async salvarHorario(h: HorarioEstado) {
    h.salvando = true;
    this.cdr.markForCheck();
    try {
      const dados: Omit<HorarioSemana, 'id'> = {
        escolaId:    this.escolaId,
        professorId: this.professorId,
        nome:        h.nome,
        linhas:      h.linhas
      };
      h.id = await this.firestoreService.salvarHorarioSemana(dados, h.id ?? undefined);
      h.editando = false;
      h._backup = null;
    } catch {
      alert('Erro ao salvar horário. Tente novamente.');
    } finally {
      h.salvando = false;
      this.cdr.markForCheck();
    }
  }

  async excluirHorario(h: HorarioEstado) {
    if (!confirm('Excluir este horário?')) return;
    if (h.id) {
      try { await this.firestoreService.deletarHorarioSemana(h.id); }
      catch { alert('Erro ao excluir. Tente novamente.'); return; }
    }
    this.horarios = this.horarios.filter(x => x !== h);
    this.cdr.markForCheck();
  }

  adicionarLinhaHorario(h: HorarioEstado) {
    const ultimo = h.linhas[h.linhas.length - 1];
    const nextIdx = this.HORARIOS_PADRAO.indexOf(ultimo?.horario ?? '') + 1;
    const horario = this.HORARIOS_PADRAO[nextIdx] ?? '';
    h.linhas = [...h.linhas, { horario, seg: '', ter: '', qua: '', qui: '', sex: '' }];
    this.cdr.markForCheck();
  }

  removerLinhaHorario(h: HorarioEstado, i: number) {
    h.linhas = h.linhas.filter((_, idx) => idx !== i);
    this.cdr.markForCheck();
  }

  horarioVazio(h: HorarioEstado): boolean {
    return h.linhas.every(l => !l.seg && !l.ter && !l.qua && !l.qui && !l.sex);
  }
}
