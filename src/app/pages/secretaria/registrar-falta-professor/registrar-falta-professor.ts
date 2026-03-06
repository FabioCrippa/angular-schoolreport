import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

interface AulaForm {
  tipoEnsino: string;
  turmasFiltradas: string[];
  turma: string;
  numeroAula: string;
}

@Component({
  selector: 'app-registrar-falta-professor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registrar-falta-professor.html',
  styleUrl: './registrar-falta-professor.scss'
})
export class RegistrarFaltaProfessor implements OnInit {

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loading = false;
  mensagem = '';
  tipoMensagem: 'sucesso' | 'erro' = 'sucesso';
  secretariaNome = '';
  secretariaId = '';
  escolaId = '';

  form = {
    data: new Date().toISOString().split('T')[0],
    professorNome: '',
    periodo: '' as 'manha' | 'tarde' | 'noite' | '',
    professorEventual: ''
  };

  aulas: AulaForm[] = [];

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

  numerosAula = ['1ª aula', '2ª aula', '3ª aula', '4ª aula', '5ª aula', '6ª aula'];

  ngOnInit() {
    this.carregarUsuario();
    this.adicionarAula();
  }

  async carregarUsuario() {
    try {
      const user = this.authService.getCurrentUser();
      if (user) {
        const usuario = await this.firestoreService.buscarUsuario(user.uid);
        if (usuario) {
          this.secretariaNome = usuario.nome;
          this.secretariaId = user.uid;
          this.escolaId = usuario.escolaId;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    }
  }

  adicionarAula() {
    this.aulas.push({ tipoEnsino: '', turmasFiltradas: [], turma: '', numeroAula: '' });
  }

  removerAula(index: number) {
    this.aulas.splice(index, 1);
  }

  onTipoEnsinoAulaChange(aula: AulaForm) {
    aula.turmasFiltradas = this.turmasPorTipo[aula.tipoEnsino] || [];
    aula.turma = '';
    this.cdr.markForCheck();
  }

  formularioValido(): boolean {
    if (!this.form.data || !this.form.professorNome.trim() || !this.form.periodo) return false;
    if (this.aulas.length === 0) return false;
    return this.aulas.every(a => a.turma && a.numeroAula);
  }

  async salvar() {
    if (!this.formularioValido()) {
      this.exibirMensagem('Preencha todos os campos obrigatórios e adicione ao menos uma aula.', 'erro');
      return;
    }

    try {
      this.loading = true;

      await this.firestoreService.salvarFaltaProfessor({
        escolaId: this.escolaId,
        data: this.form.data,
        professorNome: this.form.professorNome.trim(),
        periodo: this.form.periodo as 'manha' | 'tarde' | 'noite',
        aulas: this.aulas.map(a => ({ turma: a.turma, numeroAula: a.numeroAula })),
        professorEventual: this.form.professorEventual.trim(),
        registradoPor: this.secretariaId,
        registradoPorNome: this.secretariaNome
      });

      this.exibirMensagem('✅ Falta registrada com sucesso!', 'sucesso');
      this.limparFormulario();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      this.exibirMensagem('Erro ao registrar falta. Tente novamente.', 'erro');
    } finally {
      this.loading = false;
    }
  }

  limparFormulario() {
    this.form = {
      data: new Date().toISOString().split('T')[0],
      professorNome: '',
      periodo: '',
      professorEventual: ''
    };
    this.aulas = [];
    this.adicionarAula();
    this.cdr.markForCheck();
  }

  exibirMensagem(texto: string, tipo: 'sucesso' | 'erro') {
    this.mensagem = texto;
    this.tipoMensagem = tipo;
    this.cdr.markForCheck();
    setTimeout(() => { this.mensagem = ''; this.cdr.markForCheck(); }, 5000);
  }

  voltar() {
    this.router.navigate(['/secretaria/dashboard']);
  }
}
