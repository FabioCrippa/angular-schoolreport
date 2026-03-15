import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService } from '../../services/firestore';
import { AuthService } from '../../services/auth';

interface Reserva {
  id?: string;
  dataReserva: string;
  horaInicio: string;
  horaFim: string;
  equipamento: 'tablet' | 'notebook' | 'sala-informatica';
  professorId: string;
  professorNome: string;
  turmaId: string;
  turmaDescricao: string;
  atividade: string;
  status: 'confirmada' | 'cancelada';
  escolaId: string;
  criadoEm: any;
  tipo?: 'reserva' | 'bloqueio';
}

interface Bloqueio {
  id?: string;
  tipo: 'bloqueio';
  equipamento: 'tablet' | 'notebook' | 'sala-informatica';
  professorId: string;
  professorNome: string;
  motivo: string;
  dataInicio: string;
  dataFim: string;
  diasSemana: number[];
  horaInicio: string;
  horaFim: string;
  escolaId: string;
  criadoPor: string;
  criadoEm?: any;
}

@Component({
  selector: 'app-agendamento-equipamentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agendamento-equipamentos.html',
  styleUrl: './agendamento-equipamentos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgendamentoEquipamentosComponent implements OnInit {
  reservas: Reserva[] = [];
  filtroEquipamento: 'todos' | 'tablet' | 'notebook' | 'sala-informatica' = 'todos';
  filtroData: string = '';
  processando = false;
  mensagemErro = '';
  mensagemSucesso = '';

  // Aba ativa
  abaAtiva: 'agendamentos' | 'bloqueios' = 'agendamentos';

  // Modal agendamento
  mostrarModal = false;
  editando = false;
  reservaEmEdicao: Reserva | null = null;

  // Formulario agendamento
  dataReserva = '';
  horaInicio = '';
  horaFim = '';
  equipamento: 'tablet' | 'notebook' | 'sala-informatica' = 'tablet';
  turmaId = '';
  atividade = '';

  // Bloqueios
  bloqueios: Bloqueio[] = [];
  mostrarModalBloqueio = false;
  processandoBloqueio = false;
  bloqueioEquipamento: 'tablet' | 'notebook' | 'sala-informatica' = 'tablet';
  bloqueioMotivo = '';
  bloqueioDataInicio = '';
  bloqueioDataFim = '';
  bloqueioDiasSemana: number[] = [];
  bloqueioHoraInicio = '';
  bloqueioHoraFim = '';
  bloqueioProfessorId = '';
  bloqueioProfessorNome = '';
  professoresDaEscola: any[] = [];

  readonly DIAS_SEMANA = [
    { valor: 1, label: 'Seg' },
    { valor: 2, label: 'Ter' },
    { valor: 3, label: 'Qua' },
    { valor: 4, label: 'Qui' },
    { valor: 5, label: 'Sex' },
  ];

  // Usuario logado
  usuarioId = '';
  usuarioNome = '';
  usuarioRole = '';
  escolaId = '';
  turmas: any[] = [];

  get isCoordenacao(): boolean {
    return ['coordenacao', 'direcao', 'secretaria'].includes(this.usuarioRole);
  }

  tiposEnsino = [
    'Ensino Fundamental de 9 Anos',
    'Novo Ensino Medio'
  ];

  turmasPorTipo: { [key: string]: string[] } = {
    'Ensino Fundamental de 9 Anos': [
      '6 ano A', '6 ano B', '6 ano C', '6 ano D',
      '7 ano A', '7 ano B', '7 ano C', '7 ano D',
      '8 ano A', '8 ano B', '8 ano C', '8 ano D',
      '9 ano A', '9 ano B', '9 ano C', '9 ano D'
    ],
    'Novo Ensino Medio': [
      '1 serie A', '1 serie B', '1 serie C', '1 serie D',
      '2 serie A', '2 serie B', '2 serie C', '2 serie D',
      '3 serie A', '3 serie B', '3 serie C', '3 serie D'
    ]
  };

  turmasFiltradas: string[] = [];
  tipoEnsinoSelecionado = '';

  horarios = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00'
  ];

  private firestore = inject(FirestoreService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.inicializar();
  }

  async inicializar() {
    try {
      const escolaId = await this.auth.getEscolaId();
      if (!escolaId) return;
      this.escolaId = escolaId;

      await this.carregarReservas();

      const usuario = this.auth.getCurrentUser();
      if (usuario) {
        this.usuarioId = usuario.uid;
        this.usuarioNome = usuario.displayName || 'Professor';
        await this.carregarTurmas();
        const usuarioData = await this.firestore.buscarUsuario(usuario.uid);
        this.usuarioRole = usuarioData?.role || 'professor';
      }

      await this.carregarBloqueios();

      if (this.isCoordenacao) {
        await this.carregarProfessores();
      }

      this.cdr.markForCheck();
    } catch (erro) {
      console.error('Erro ao inicializar:', erro);
    }
  }

  async carregarReservas() {
    try {
      const todas = await this.firestore.obterAgendaEquipamentos(this.escolaId);
      this.reservas = todas.filter((r: any) => r.tipo !== 'bloqueio');
      this.cdr.markForCheck();
    } catch (erro) {
      console.error('Erro ao carregar reservas:', erro);
      this.mensagemErro = 'Erro ao carregar agendamentos';
    }
  }

  async carregarBloqueios() {
    try {
      this.bloqueios = await this.firestore.obterBloqueiosPeriodo(this.escolaId);
      this.cdr.markForCheck();
    } catch (erro) {
      console.error('Erro ao carregar bloqueios:', erro);
    }
  }

  async carregarProfessores() {
    try {
      this.professoresDaEscola = await this.firestore.obterProfessoresDaEscola(this.escolaId);
      this.cdr.markForCheck();
    } catch (erro) {
      console.error('Erro ao carregar professores:', erro);
    }
  }

  async carregarTurmas() {
    try {
      const usuario = this.auth.getCurrentUser();
      if (usuario) {
        this.turmas = await this.firestore.obterTurmasProfessor(usuario.uid);
      }
    } catch (erro) {
      console.error('Erro ao carregar turmas:', erro);
    }
  }

  get mostrarGrade(): boolean {
    return this.filtroData !== '' && this.filtroEquipamento !== 'todos';
  }

  // ── Calendário mensal de disponibilidade ──
  readonly NOMES_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  readonly NOMES_DIAS_CAL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  readonly hoje = new Date().toISOString().substring(0, 10);

  mesCalAtual = new Date().toISOString().substring(0, 7);
  mesCalModal  = new Date().toISOString().substring(0, 7);

  get nomeMesAtual(): string {
    const [ano, mes] = this.mesCalAtual.split('-').map(Number);
    return `${this.NOMES_MESES[mes - 1]} ${ano}`;
  }

  navegarMes(delta: number) {
    const [ano, mes] = this.mesCalAtual.split('-').map(Number);
    const d = new Date(ano, mes - 1 + delta, 1);
    this.mesCalAtual = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    this.cdr.markForCheck();
  }

  get diasCalMes(): { data: string; dia: number; diaSemana: number; status: 'livre' | 'reservado' | 'bloqueado' | 'fora' | 'fds' }[] {
    const [ano, mes] = this.mesCalAtual.split('-').map(Number);
    const primeiroDia = new Date(ano, mes - 1, 1).getDay();
    const ultimoDia  = new Date(ano, mes, 0).getDate();
    const dias: { data: string; dia: number; diaSemana: number; status: 'livre' | 'reservado' | 'bloqueado' | 'fora' | 'fds' }[] = [];

    for (let i = 0; i < primeiroDia; i++) {
      dias.push({ data: '', dia: 0, diaSemana: i, status: 'fora' });
    }

    for (let d = 1; d <= ultimoDia; d++) {
      const mm   = String(mes).padStart(2, '0');
      const dd   = String(d).padStart(2, '0');
      const data = `${ano}-${mm}-${dd}`;
      const dow  = new Date(ano, mes - 1, d).getDay();

      if (dow === 0 || dow === 6) {
        dias.push({ data, dia: d, diaSemana: dow, status: 'fds' });
        continue;
      }

      const equip = this.filtroEquipamento;

      const hasBloqueio = this.bloqueios.some(b => {
        const eqOk = equip === 'todos' || b.equipamento === equip;
        return eqOk && b.dataInicio <= data && b.dataFim >= data && b.diasSemana.includes(dow);
      });

      if (hasBloqueio) {
        dias.push({ data, dia: d, diaSemana: dow, status: 'bloqueado' });
        continue;
      }

      const hasReserva = this.reservas.some(r => {
        const eqOk = equip === 'todos' || r.equipamento === equip;
        return eqOk && r.status === 'confirmada' && r.dataReserva === data;
      });

      dias.push({ data, dia: d, diaSemana: dow, status: hasReserva ? 'reservado' : 'livre' });
    }

    return dias;
  }

  selecionarDia(data: string, status: string) {
    if (!data || status === 'fora' || status === 'fds') return;
    this.filtroData = data;
    if (this.filtroEquipamento === 'todos') this.filtroEquipamento = 'tablet';
    this.cdr.markForCheck();
  }

  navegarMesModal(delta: number) {
    const [ano, mes] = this.mesCalModal.split('-').map(Number);
    const d = new Date(ano, mes - 1 + delta, 1);
    this.mesCalModal = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    this.cdr.markForCheck();
  }

  get nomeMesModal(): string {
    const [ano, mes] = this.mesCalModal.split('-').map(Number);
    return `${this.NOMES_MESES[mes - 1]} ${ano}`;
  }

  get diasCalModal(): { data: string; dia: number; diaSemana: number; status: 'livre' | 'reservado' | 'bloqueado' | 'fora' | 'fds' | 'passado' }[] {
    const [ano, mes] = this.mesCalModal.split('-').map(Number);
    const primeiroDia = new Date(ano, mes - 1, 1).getDay();
    const ultimoDia  = new Date(ano, mes, 0).getDate();
    const equip = this.equipamento;
    const dias: { data: string; dia: number; diaSemana: number; status: 'livre' | 'reservado' | 'bloqueado' | 'fora' | 'fds' | 'passado' }[] = [];

    for (let i = 0; i < primeiroDia; i++) {
      dias.push({ data: '', dia: 0, diaSemana: i, status: 'fora' });
    }

    for (let d = 1; d <= ultimoDia; d++) {
      const mm   = String(mes).padStart(2, '0');
      const dd   = String(d).padStart(2, '0');
      const data = `${ano}-${mm}-${dd}`;
      const dow  = new Date(ano, mes - 1, d).getDay();

      if (dow === 0 || dow === 6) {
        dias.push({ data, dia: d, diaSemana: dow, status: 'fds' });
        continue;
      }
      if (data < this.hoje) {
        dias.push({ data, dia: d, diaSemana: dow, status: 'passado' });
        continue;
      }

      const hasBloqueio = this.bloqueios.some(b =>
        b.equipamento === equip &&
        b.dataInicio <= data &&
        b.dataFim >= data &&
        b.diasSemana.includes(dow)
      );
      if (hasBloqueio) {
        dias.push({ data, dia: d, diaSemana: dow, status: 'bloqueado' });
        continue;
      }

      const hasReserva = this.reservas.some(r =>
        r.status === 'confirmada' &&
        r.dataReserva === data &&
        r.equipamento === equip
      );
      dias.push({ data, dia: d, diaSemana: dow, status: hasReserva ? 'reservado' : 'livre' });
    }

    return dias;
  }

  selecionarDiaModal(data: string, status: string) {
    if (!data || status === 'fora' || status === 'fds' || status === 'passado') return;
    this.dataReserva = data;
    this.cdr.markForCheck();
  }

  statusSlot(hora: string): { status: 'livre' | 'ocupado' | 'bloqueado'; info: string } {
    const equip = this.filtroEquipamento as 'tablet' | 'notebook' | 'sala-informatica';
    const data = this.filtroData;
    const diaSemana = new Date(data + 'T12:00:00').getDay();

    const blq = this.bloqueios.find(b =>
      b.equipamento === equip &&
      b.dataInicio <= data &&
      b.dataFim >= data &&
      b.diasSemana.includes(diaSemana) &&
      b.horaInicio <= hora &&
      b.horaFim > hora
    );
    if (blq) {
      const prof = blq.professorNome ? ' – ' + blq.professorNome : '';
      return { status: 'bloqueado', info: blq.motivo + prof };
    }

    const res = this.reservas.find(r =>
      r.status === 'confirmada' &&
      r.dataReserva === data &&
      r.equipamento === equip &&
      r.horaInicio <= hora &&
      r.horaFim > hora
    );
    if (res) return { status: 'ocupado', info: res.professorNome + ' • ' + res.atividade };

    return { status: 'livre', info: 'Clique para agendar' };
  }

  agendarSlot(hora: string) {
    this.editando = false;
    this.reservaEmEdicao = null;
    this.limparFormulario();
    this.dataReserva = this.filtroData;
    this.equipamento = this.filtroEquipamento as 'tablet' | 'notebook' | 'sala-informatica';
    this.horaInicio = hora;
    this.mensagemErro = '';
    this.mostrarModal = true;
  }

  get reservasFiltradas() {
    return this.reservas.filter(r => {
      if (r.status === 'cancelada') return false;
      if (this.filtroEquipamento !== 'todos' && r.equipamento !== this.filtroEquipamento) return false;
      if (this.filtroData && r.dataReserva !== this.filtroData) return false;
      return true;
    }).sort((a, b) => {
      const dataA = new Date(a.dataReserva + 'T' + a.horaInicio);
      const dataB = new Date(b.dataReserva + 'T' + b.horaInicio);
      return dataA.getTime() - dataB.getTime();
    });
  }

  horarioBloqueado(dataStr: string, horaIni: string, horaFimStr: string, equip: string): Bloqueio | null {
    const data = new Date(dataStr + 'T12:00:00');
    const diaSemana = data.getDay();
    return this.bloqueios.find(b =>
      b.equipamento === equip &&
      b.dataInicio <= dataStr &&
      b.dataFim >= dataStr &&
      b.diasSemana.includes(diaSemana) &&
      b.horaInicio <= horaIni &&
      b.horaFim >= horaFimStr
    ) ?? null;
  }

  abrirModal() {
    this.editando = false;
    this.reservaEmEdicao = null;
    this.limparFormulario();
    this.mensagemErro = '';
    this.mesCalModal = new Date().toISOString().substring(0, 7);
    this.mostrarModal = true;
  }

  fecharModal() {
    this.mostrarModal = false;
    this.limparFormulario();
  }

  voltar() {
    this.router.navigate(['/dashboard']);
  }

  limparFormulario() {
    this.dataReserva = '';
    this.horaInicio = '';
    this.horaFim = '';
    this.equipamento = 'tablet';
    this.tipoEnsinoSelecionado = '';
    this.turmaId = '';
    this.turmasFiltradas = [];
    this.atividade = '';
  }

  onTipoEnsinoChange(tipoEnsino: string) {
    this.tipoEnsinoSelecionado = tipoEnsino;
    this.turmasFiltradas = this.turmasPorTipo[tipoEnsino] || [];
    this.turmaId = '';
  }

  editarReserva(reserva: Reserva) {
    if (reserva.professorId !== this.usuarioId) {
      this.mensagemErro = 'Voce so pode editar seus proprios agendamentos';
      return;
    }
    this.editando = true;
    this.reservaEmEdicao = reserva;
    this.dataReserva = reserva.dataReserva;
    this.horaInicio = reserva.horaInicio;
    this.horaFim = reserva.horaFim;
    this.equipamento = reserva.equipamento;
    this.turmaId = reserva.turmaId;
    this.atividade = reserva.atividade;
    this.mostrarModal = true;
  }

  async criarOuEditarReserva() {
    if (!this.validarFormulario()) return;

    this.processando = true;
    this.mensagemErro = '';

    try {
      const novaReserva: Reserva = {
        dataReserva: this.dataReserva,
        horaInicio: this.horaInicio,
        horaFim: this.horaFim,
        equipamento: this.equipamento,
        professorId: this.usuarioId,
        professorNome: this.usuarioNome,
        turmaId: this.turmaId,
        turmaDescricao: this.turmaId,
        atividade: this.atividade,
        status: 'confirmada',
        escolaId: this.escolaId,
        criadoEm: new Date()
      };

      if (this.editando && this.reservaEmEdicao?.id) {
        await this.firestore.atualizarAgendaEquipamento(this.reservaEmEdicao.id, novaReserva);
        this.mensagemSucesso = 'Agendamento atualizado com sucesso!';
      } else {
        const bloqueio = this.horarioBloqueado(this.dataReserva, this.horaInicio, this.horaFim, this.equipamento);
        if (bloqueio) {
          this.mensagemErro = 'Horario reservado para: ' + bloqueio.motivo + ' (' + bloqueio.professorNome + '). Entre em contato com a coordenacao.';
          this.processando = false;
          return;
        }

        const conflito = this.reservas.find(r =>
          r.status === 'confirmada' &&
          r.dataReserva === this.dataReserva &&
          r.equipamento === this.equipamento &&
          r.horaInicio === this.horaInicio &&
          r.horaFim === this.horaFim
        );

        if (conflito) {
          const equip = this.equipamento.charAt(0).toUpperCase() + this.equipamento.slice(1);
          this.mensagemErro = equip + ' ja esta reservado neste horario';
          this.processando = false;
          return;
        }

        await this.firestore.criarAgendaEquipamento(novaReserva);
        this.mensagemSucesso = 'Agendamento criado com sucesso!';
      }

      this.fecharModal();
      setTimeout(() => { this.carregarReservas(); }, 100);
      setTimeout(() => { this.mensagemSucesso = ''; this.cdr.markForCheck(); }, 2500);
    } catch (erro) {
      console.error('Erro:', erro);
      this.mensagemErro = 'Erro ao salvar agendamento. Tente novamente.';
    } finally {
      this.processando = false;
      this.cdr.markForCheck();
    }
  }

  validarFormulario(): boolean {
    this.mensagemErro = '';

    if (!this.dataReserva) {
      this.mensagemErro = 'Data e obrigatoria';
      return false;
    }

    if (!this.horaInicio || !this.horaFim) {
      this.mensagemErro = 'Horario de inicio e fim sao obrigatorios';
      return false;
    }

    if (this.horaInicio >= this.horaFim) {
      this.mensagemErro = 'Hora de fim deve ser posterior a hora de inicio';
      return false;
    }

    if (this.dataReserva < this.obterDataHoje()) {
      this.mensagemErro = 'Nao e possivel agendar para datas passadas';
      return false;
    }

    if (this.dataReserva === this.obterDataHoje()) {
      const agora = new Date();
      const horaAtualStr = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
      if (this.horaInicio < horaAtualStr) {
        this.mensagemErro = 'Nao e possivel agendar para horarios passados';
        return false;
      }
    }

    return true;
  }

  async cancelarReserva(reserva: Reserva) {
    if (reserva.professorId !== this.usuarioId) {
      alert('Voce so pode cancelar seus proprios agendamentos');
      return;
    }

    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) {
      return;
    }

    try {
      if (reserva.id) {
        await this.firestore.cancelarAgendaEquipamento(reserva.id);
        this.carregarReservas();
        this.mensagemSucesso = 'Agendamento cancelado';
        setTimeout(() => { this.mensagemSucesso = ''; this.cdr.markForCheck(); }, 2000);
      }
    } catch (erro) {
      console.error('Erro ao cancelar:', erro);
      this.mensagemErro = 'Erro ao cancelar agendamento';
    }
  }

  // Bloqueios

  abrirModalBloqueio() {
    this.bloqueioEquipamento = 'tablet';
    this.bloqueioMotivo = '';
    this.bloqueioDataInicio = '';
    this.bloqueioDataFim = '';
    this.bloqueioDiasSemana = [];
    this.bloqueioHoraInicio = '';
    this.bloqueioHoraFim = '';
    this.bloqueioProfessorId = '';
    this.bloqueioProfessorNome = '';
    this.mensagemErro = '';
    this.mostrarModalBloqueio = true;
  }

  fecharModalBloqueio() {
    this.mostrarModalBloqueio = false;
    this.mensagemErro = '';
  }

  toggleDiaSemana(dia: number) {
    const idx = this.bloqueioDiasSemana.indexOf(dia);
    if (idx >= 0) {
      this.bloqueioDiasSemana.splice(idx, 1);
    } else {
      this.bloqueioDiasSemana.push(dia);
    }
  }

  diaSelecionado(dia: number): boolean {
    return this.bloqueioDiasSemana.includes(dia);
  }

  onProfessorChange(professorId: string) {
    const prof = this.professoresDaEscola.find(p => p.id === professorId);
    this.bloqueioProfessorNome = prof?.nome || '';
  }

  async salvarBloqueio() {
    if (!this.bloqueioMotivo || !this.bloqueioDataInicio || !this.bloqueioDataFim ||
        !this.bloqueioHoraInicio || !this.bloqueioHoraFim || this.bloqueioDiasSemana.length === 0) {
      this.mensagemErro = 'Preencha todos os campos e selecione ao menos um dia da semana.';
      return;
    }
    if (this.bloqueioDataInicio > this.bloqueioDataFim) {
      this.mensagemErro = 'Data final deve ser posterior a data inicial.';
      return;
    }
    if (this.bloqueioHoraInicio >= this.bloqueioHoraFim) {
      this.mensagemErro = 'Hora de fim deve ser posterior a hora de inicio.';
      return;
    }

    this.processandoBloqueio = true;
    this.mensagemErro = '';

    try {
      const novoBloqueio: Omit<Bloqueio, 'id'> = {
        tipo: 'bloqueio',
        equipamento: this.bloqueioEquipamento,
        professorId: this.bloqueioProfessorId,
        professorNome: this.bloqueioProfessorNome,
        motivo: this.bloqueioMotivo,
        dataInicio: this.bloqueioDataInicio,
        dataFim: this.bloqueioDataFim,
        diasSemana: [...this.bloqueioDiasSemana].sort(),
        horaInicio: this.bloqueioHoraInicio,
        horaFim: this.bloqueioHoraFim,
        escolaId: this.escolaId,
        criadoPor: this.usuarioId
      };

      await this.firestore.criarBloqueio(novoBloqueio);
      this.fecharModalBloqueio();
      await this.carregarBloqueios();
      this.mensagemSucesso = 'Bloqueio criado com sucesso!';
      setTimeout(() => { this.mensagemSucesso = ''; this.cdr.markForCheck(); }, 2500);
    } catch (erro) {
      console.error('Erro ao salvar bloqueio:', erro);
      this.mensagemErro = 'Erro ao criar bloqueio. Tente novamente.';
    } finally {
      this.processandoBloqueio = false;
      this.cdr.markForCheck();
    }
  }

  async removerBloqueio(bloqueioId: string) {
    if (!confirm('Remover este bloqueio de periodo?')) return;
    try {
      await this.firestore.deletarBloqueio(bloqueioId);
      await this.carregarBloqueios();
      this.mensagemSucesso = 'Bloqueio removido';
      setTimeout(() => { this.mensagemSucesso = ''; this.cdr.markForCheck(); }, 2000);
    } catch (erro) {
      console.error('Erro ao remover bloqueio:', erro);
      this.mensagemErro = 'Erro ao remover bloqueio';
    }
    this.cdr.markForCheck();
  }

  formatarDiasSemana(diasSemana: number[]): string {
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    return diasSemana.map(d => nomes[d]).join(', ');
  }

  obterDataHoje(): string {
    const hoje = new Date();
    return hoje.getFullYear() + '-' +
      String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
      String(hoje.getDate()).padStart(2, '0');
  }

  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia)).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
  }

  obterEquipamentoEmPortugues(equipamento: string): string {
    const mapa: Record<string, string> = {
      'tablet': 'Tablet',
      'notebook': 'Notebook',
      'sala-informatica': 'Sala de Informatica'
    };
    return mapa[equipamento] || equipamento;
  }

  async exportarPDF() {
    await this.carregarReservas();
    const reservasAtivas = this.reservas
      .filter(r => r.status !== 'cancelada')
      .sort((a, b) => a.dataReserva.localeCompare(b.dataReserva) || a.horaInicio.localeCompare(b.horaInicio));

    const grupos = new Map<string, Reserva[]>();
    for (const r of reservasAtivas) {
      if (!grupos.has(r.dataReserva)) grupos.set(r.dataReserva, []);
      grupos.get(r.dataReserva)!.push(r);
    }

    const equipamentoCor: Record<string, string> = {
      'tablet': '#2563EB',
      'notebook': '#7C3AED',
      'sala-informatica': '#059669'
    };

    const linhas = [...grupos.entries()].map(([data, rs]) => {
      const [ano, mes, dia] = data.split('-');
      const dataObj = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      const rows = rs.map(r => {
        const cor = equipamentoCor[r.equipamento] || '#374151';
        return `
          <tr>
            <td style="font-weight:600;color:${cor}">${this.obterEquipamentoEmPortugues(r.equipamento)}</td>
            <td>${r.horaInicio} – ${r.horaFim}</td>
            <td>${r.professorNome}</td>
            <td>${r.turmaDescricao}</td>
            <td>${r.atividade}</td>
          </tr>`;
      }).join('');
      return `
        <tr class="data-header">
          <td colspan="5">${dataFormatada}</td>
        </tr>
        ${rows}`;
    }).join('');

    const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Agenda de Equipamentos</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .subtitulo { font-size: 12px; color: #6B7280; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1E3A5F; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; }
    td { padding: 7px 10px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr.data-header td { background: #F3F4F6; font-weight: 700; font-size: 13px; color: #1E3A5F; padding: 10px; border-top: 2px solid #1E3A5F; letter-spacing: 0.3px; }
    tr:not(.data-header):hover td { background: #F9FAFB; }
    .rodape { margin-top: 24px; font-size: 11px; color: #9CA3AF; text-align: right; }
    @media print {
      body { padding: 12px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>📅 Agenda de Equipamentos</h1>
  <p class="subtitulo">Gerado em ${dataGeracao} · Apenas agendamentos confirmados</p>
  ${reservasAtivas.length === 0 ? '<p style="color:#6B7280;padding:24px 0">Nenhum agendamento confirmado.</p>' : `
  <table>
    <thead>
      <tr>
        <th>Equipamento</th>
        <th>Horário</th>
        <th>Professor(a)</th>
        <th>Turma</th>
        <th>Atividade</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>`}
  <p class="rodape">ReportOnClass · Agenda de Equipamentos</p>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 500);
    }
  }
}
