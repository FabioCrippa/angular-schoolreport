import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, Aluno, Falta } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-registrar-faltas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registrar-faltas.html',
  styleUrl: './registrar-faltas.scss'
})
export class RegistrarFaltas implements OnInit {
  
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  
  escolaId = '';
  usuarioId = '';
  usuarioNome = '';
  
  turmas: string[] = [];
  alunosSelecionados: Aluno[] = [];
  faltas: { [alunoId: string]: boolean } = {}; // true = presente, false = ausente
  
  turmaAtual = '';
  dataSelecionada = '';
  faltaExistente: Falta | null = null;
  
  loading = false;
  agrupamentoTurma = true;
  
  mensagem = '';
  tipoMensagem: 'sucesso' | 'erro' | 'info' = 'info';
  
  ngOnInit() {
    this.carregarDados();
    this.definirDataAtual();
  }
  
  async carregarDados() {
    try {
      const user = this.authService.getCurrentUser();
      if (user) {
        this.usuarioId = user.uid;
        const usuario = await this.firestoreService.buscarUsuario(user.uid);
        if (usuario) {
          this.escolaId = usuario.escolaId;
          this.usuarioNome = usuario.nome;
          await this.obterTurmas();
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.exibirMensagem('Erro ao carregar dados', 'erro');
    }
  }
  
  async obterTurmas() {
    try {
      this.loading = true;
      const alunos = await this.firestoreService.obterAlunos(this.escolaId);
      
      // Extrair turmas únicas
      const turmasSet = new Set(alunos.map(a => a.turma));
      this.turmas = Array.from(turmasSet).sort();
      
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Erro ao obter turmas:', error);
      this.exibirMensagem('Erro ao carregar turmas', 'erro');
    } finally {
      this.loading = false;
    }
  }
  
  async aoSelecionarTurma() {
    // Se deselecionou (voltou para "Selecione turma"), limpar alunos
    if (!this.turmaAtual) {
      this.alunosSelecionados = [];
      this.faltas = {};
      this.faltaExistente = null;
      this.cdr.markForCheck();
      return;
    }
    
    try {
      this.loading = true;
      
      // Obter alunos da turma
      const todosAlunos = await this.firestoreService.obterAlunos(this.escolaId);
      this.alunosSelecionados = todosAlunos.filter(a => a.turma === this.turmaAtual);
      
      // Verificar se já existe registro de faltas para esta turma/data
      this.faltaExistente = await this.firestoreService.obterFaltasPorTurmaEData(
        this.escolaId,
        this.turmaAtual,
        this.dataSelecionada
      );
      
      // Inicializar ou carregar faltas
      this.inicializarFaltas();
      
      this.cdr.markForCheck();
      this.exibirMensagem(`${this.alunosSelecionados.length} alunos carregados`, 'info');
      
    } catch (error) {
      console.error('Erro ao selecionar turma:', error);
      this.exibirMensagem('Erro ao carregar alunos da turma', 'erro');
    } finally {
      this.loading = false;
    }
  }
  
  async aoAlterarData() {
    if (!this.turmaAtual) {
      return;
    }
    
    try {
      this.loading = true;
      
      // Verificar se já existe registro de faltas para esta turma/data
      this.faltaExistente = await this.firestoreService.obterFaltasPorTurmaEData(
        this.escolaId,
        this.turmaAtual,
        this.dataSelecionada
      );
      
      // Reinicializar ou carregar faltas
      this.inicializarFaltas();
      
      this.cdr.markForCheck();
      
    } catch (error) {
      console.error('Erro ao alterar data:', error);
      this.exibirMensagem('Erro ao carregar faltas da data', 'erro');
    } finally {
      this.loading = false;
    }
  }
  
  inicializarFaltas() {
    this.faltas = {};
    
    if (this.faltaExistente && this.faltaExistente.alunos) {
      // Carregar faltas existentes
      Object.keys(this.faltaExistente.alunos).forEach(alunoId => {
        this.faltas[alunoId] = this.faltaExistente!.alunos[alunoId].presente;
      });
    } else {
      // Inicializar novos registros (todos presentes por padrão)
      this.alunosSelecionados.forEach(aluno => {
        if (aluno.id) {
          this.faltas[aluno.id] = true; // true = presente
        }
      });
    }
  }
  
  togglePresenca(alunoId: string) {
    if (alunoId in this.faltas) {
      this.faltas[alunoId] = !this.faltas[alunoId];
    }
  }
  
  obterContadores() {
    const valores = Object.values(this.faltas);
    const presentes = valores.filter(v => v === true).length;
    const ausentes = valores.filter(v => v === false).length;
    return { presentes, ausentes, total: valores.length };
  }
  
  async salvarFaltas() {
    try {
      if (!this.turmaAtual || !this.dataSelecionada) {
        this.exibirMensagem('Selecione turma e data', 'erro');
        return;
      }
      
      this.loading = true;
      
      // Preparar dados de faltas
      const alunosData: Falta['alunos'] = {};
      this.alunosSelecionados.forEach(aluno => {
        if (aluno.id) {
          alunosData[aluno.id] = {
            alunoNome: aluno.nome,
            presente: this.faltas[aluno.id] ?? true
          };
        }
      });
      
      if (this.faltaExistente && this.faltaExistente.id) {
        // Atualizar faltas existentes
        await this.firestoreService.atualizarFaltas(this.faltaExistente.id, alunosData);
      } else {
        // Criar novo registro
        const novaFalta: Omit<Falta, 'id' | 'registradoEm'> = {
          escolaId: this.escolaId,
          turma: this.turmaAtual,
          data: this.dataSelecionada,
          alunos: alunosData,
          registradoPor: this.usuarioId,
          registradoPorNome: this.usuarioNome
        };
        
        await this.firestoreService.registrarFaltas(this.escolaId, novaFalta);
      }
      
      this.exibirMensagem('✅ Faltas salvas com sucesso!', 'sucesso');
      this.cdr.markForCheck();
      
      // Reset automático após 2 segundos
      setTimeout(() => {
        this.resetarFormulario();
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao salvar faltas:', error);
      this.exibirMensagem('Erro ao salvar faltas', 'erro');
    } finally {
      this.loading = false;
    }
  }
  
  marcarTodos(presente: boolean) {
    Object.keys(this.faltas).forEach(alunoId => {
      this.faltas[alunoId] = presente;
    });
  }
  
  definirDataAtual() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    this.dataSelecionada = `${ano}-${mes}-${dia}`;
  }
  
  formatarData(data: string): string {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  
  exibirMensagem(texto: string, tipo: 'sucesso' | 'erro' | 'info') {
    this.mensagem = texto;
    this.tipoMensagem = tipo;
    
    setTimeout(() => {
      this.mensagem = '';
    }, 4000);
  }
  
  resetarFormulario() {
    this.turmaAtual = '';
    this.alunosSelecionados = [];
    this.faltas = {};
    this.faltaExistente = null;
    this.cdr.markForCheck();
  }
  
  voltar() {
    this.router.navigate(['/secretaria/dashboard']);
  }
}
