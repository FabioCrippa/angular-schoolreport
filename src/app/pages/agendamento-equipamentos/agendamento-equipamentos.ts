import { Component, OnInit, inject } from '@angular/core';
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
  criadoEm: any;
}

@Component({
  selector: 'app-agendamento-equipamentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agendamento-equipamentos.html',
  styleUrl: './agendamento-equipamentos.scss'
})
export class AgendamentoEquipamentosComponent implements OnInit {
  reservas: Reserva[] = [];
  filtroEquipamento: 'todos' | 'tablet' | 'notebook' = 'todos';
  filtroData: string = '';
  processando = false;
  mensagemErro = '';
  mensagemSucesso = '';

  // Modal
  mostrarModal = false;
  editando = false;
  reservaEmEdicao: Reserva | null = null;

  // Formulário
  dataReserva = '';
  horaInicio = '';
  horaFim = '';
  equipamento: 'tablet' | 'notebook' | 'sala-informatica' = 'tablet';
  turmaId = '';
  atividade = '';

  // Data para usuario logado
  usuarioId = '';
  usuarioNome = '';
  turmas: any[] = [];
  
  // Tipos de Ensino e Turmas
  tiposEnsino = [
    'Ensino Fundamental de 9 Anos',
    'Novo Ensino Médio'
  ];
  
  turmasPorTipo: { [key: string]: string[] } = {
    'Ensino Fundamental de 9 Anos': [
      '6º ano A', '6º ano B', '6º ano C', '6º ano D',
      '7º ano A', '7º ano B', '7º ano C', '7º ano D',
      '8º ano A', '8º ano B', '8º ano C', '8º ano D',
      '9º ano A', '9º ano B', '9º ano C', '9º ano D'
    ],
    'Novo Ensino Médio': [
      '1ª série A', '1ª série B', '1ª série C', '1ª série D',
      '2ª série A', '2ª série B', '2ª série C', '2ª série D',
      '3ª série A', '3ª série B', '3ª série C', '3ª série D'
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

  ngOnInit() {
    this.inicializar();
  }

  async inicializar() {
    try {
      const usuario = this.auth.getCurrentUser();
      if (usuario) {
        this.usuarioId = usuario.uid;
        this.usuarioNome = usuario.displayName || 'Professor';
        await this.carregarReservas();
        await this.carregarTurmas();
      }
    } catch (erro) {
      console.error('Erro ao inicializar:', erro);
    }
  }

  async carregarReservas() {
    try {
      this.reservas = await this.firestore.obterAgendaEquipamentos();
    } catch (erro) {
      console.error('Erro ao carregar reservas:', erro);
      this.mensagemErro = 'Erro ao carregar agendamentos';
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

  abrirModal() {
    this.editando = false;
    this.reservaEmEdicao = null;
    this.limparFormulario();
    this.mensagemErro = '';
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
      this.mensagemErro = 'Você só pode editar seus próprios agendamentos';
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
        criadoEm: new Date()
      };

      if (this.editando && this.reservaEmEdicao?.id) {
        await this.firestore.atualizarAgendaEquipamento(this.reservaEmEdicao.id, novaReserva);
        this.mensagemSucesso = 'Agendamento atualizado com sucesso!';
      } else {
        // Verificar se já existe reserva no mesmo horário
        const conflito = this.reservas.find(r => 
          r.status === 'confirmada' &&
          r.dataReserva === this.dataReserva &&
          r.equipamento === this.equipamento &&
          r.horaInicio === this.horaInicio &&
          r.horaFim === this.horaFim
        );

        if (conflito) {
          this.mensagemErro = `${this.equipamento.charAt(0).toUpperCase() + this.equipamento.slice(1)} já está reservado neste horário`;
          this.processando = false;
          return;
        }

        await this.firestore.criarAgendaEquipamento(novaReserva);
        this.mensagemSucesso = 'Agendamento criado com sucesso!';
      }

      // Fechar modal imediatamente
      this.fecharModal();
      
      // Recarregar dados sem bloquear
      setTimeout(() => {
        this.carregarReservas();
      }, 100);
      
      // Limpar mensagem após visualização
      setTimeout(() => {
        this.mensagemSucesso = '';
      }, 2500);
    } catch (erro) {
      console.error('Erro:', erro);
      this.mensagemErro = 'Erro ao salvar agendamento. Tente novamente.';
    } finally {
      this.processando = false;
    }
  }

  validarFormulario(): boolean {
    this.mensagemErro = '';

    if (!this.dataReserva) {
      this.mensagemErro = 'Data é obrigatória';
      return false;
    }

    if (!this.horaInicio || !this.horaFim) {
      this.mensagemErro = 'Horário de início e fim são obrigatórios';
      return false;
    }

    if (this.horaInicio >= this.horaFim) {
      this.mensagemErro = 'Hora de fim deve ser posterior à hora de início';
      return false;
    }

    if (this.dataReserva < this.obterDataHoje()) {
      this.mensagemErro = 'Não é possível agendar para datas passadas';
      return false;
    }

    // Validar hora passada se for hoje
    if (this.dataReserva === this.obterDataHoje()) {
      const agora = new Date();
      const horaAtualStr = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
      if (this.horaInicio < horaAtualStr) {
        this.mensagemErro = 'Não é possível agendar para horários passados';
        return false;
      }
    }

    return true;
  }

  async cancelarReserva(reserva: Reserva) {
    if (reserva.professorId !== this.usuarioId) {
      alert('Você só pode cancelar seus próprios agendamentos');
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
        setTimeout(() => this.mensagemSucesso = '', 2000);
      }
    } catch (erro) {
      console.error('Erro ao cancelar:', erro);
      this.mensagemErro = 'Erro ao cancelar agendamento';
    }
  }

  obterDataHoje(): string {
    const data = new Date();
    return data.toISOString().split('T')[0];
  }

  obterDataProxima7Dias(): string {
    const data = new Date();
    data.setDate(data.getDate() + 7);
    return data.toISOString().split('T')[0];
  }

  obterDataLimite(): string {
    const data = new Date();
    data.setDate(data.getDate() + 60);
    return data.toISOString().split('T')[0];
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
    const mapa = {
      'tablet': 'Tablet',
      'notebook': 'Notebook',
      'sala-informatica': 'Sala de Informática'
    };
    return mapa[equipamento as keyof typeof mapa] || equipamento;
  }
}
