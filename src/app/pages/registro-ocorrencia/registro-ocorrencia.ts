import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { FirestoreService } from '../../services/firestore';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-registro-ocorrencia',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './registro-ocorrencia.html',
  styleUrl: './registro-ocorrencia.scss',
})
export class RegistroOcorrencia {

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);

  ocorrenciaForm: FormGroup;
  showConfirm = false;
  loading = false;
  isAdmin = false;
  professorNome = 'Professor'; // Nome do professor logado

  private ADMIN_EMAILS = ['professor@escola.com'];

  tiposOcorrencia = [
    'Atraso',
    'Agressão física',
    'Agressão verbal',
    'Bullying',
    'Comportamento inadequado',
    'Desrespeito a colegas',
    'Desrespeito a professores',
    'Falta',
    'Falta de material',
    'Indisciplina',
    'Uso de celular',
    'Vandalismo',    
    'Outros',
  ];

  gravidades = [
    { value: 'Leve', label: 'Leve' },
    { value: 'Moderada', label: 'Moderada' },
    { value: 'Grave', label: 'Grave' },
  ];

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

  disciplinas = [
    'Arte',
    'Biologia',
    'Ciências',
    'Educação Física',
    'Espanhol',
    'Filosofia',
    'Física',
    'Geografia',
    'História',
    'Inglês',
    'Literatura',
    'Matemática',
    'Português',
    'Química',
    'Sociologia',
    'Outra'
  ];

  constructor() {
    const hoje = new Date().toISOString().split('T')[0];
    
    this.ocorrenciaForm = this.fb.group({
      nomeAluno: ['', Validators.required],
      data: [hoje, Validators.required],
      tipoEnsino: ['', Validators.required],
      turma: ['', Validators.required],
      disciplina: ['', Validators.required],
      tipoOcorrencia: ['', Validators.required],
      gravidade: ['', Validators.required],
      descricao: ['', [Validators.required, Validators.minLength(10)]],
    })
    
    // Verifica se o usuário é admin
    const user = this.authService.getCurrentUser();
    if (user) {
      this.isAdmin = this.ADMIN_EMAILS.includes(user.email || '');
      
      // Buscar nome do usuário no Firestore
      this.carregarNomeUsuario();
    }
  }
  
  async carregarNomeUsuario() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;
      
      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      if (usuario && usuario.nome) {
        this.professorNome = usuario.nome;
      }
    } catch (error) {
      console.error('Erro ao buscar nome do usuário:', error);
    }
  }

  onSubmit() {
    if (this.ocorrenciaForm.valid) {
      this.showConfirm = true;
    }
  }
  
  async confirmarEnvio() {
    this.showConfirm = false;
    this.loading = true;
    
    try {
      const formData = this.ocorrenciaForm.value;
      const user = this.authService.getCurrentUser();
      
      // Buscar escolaId do usuário logado
      const escolaId = await this.authService.getEscolaId();
      
      if (!escolaId) {
        alert('Erro: Usuário não vinculado a nenhuma escola. Contate o administrador.');
        this.loading = false;
        return;
      }
      
      // Buscar dados da escola para enviar email
      const escolaData = await this.firestoreService.buscarEscola(escolaId);
      
      await this.firestoreService.adicionarOcorrencia({
        escolaId: escolaId,
        nomeAluno: formData.nomeAluno,
        data: formData.data,
        tipoEnsino: formData.tipoEnsino,
        turma: formData.turma,
        disciplina: formData.disciplina,
        tipoOcorrencia: formData.tipoOcorrencia,
        gravidade: formData.gravidade,
        descricao: formData.descricao,
        professorEmail: user?.email || 'desconhecido@email.com',
        professorNome: this.professorNome
      }, escolaData ? {
        nome: escolaData.nome,
        emailCoordenacao: escolaData.emailCoordenacao,
        emailDirecao: escolaData.emailDirecao
      } : undefined);
      
      alert('Ocorrência registrada com sucesso! Email enviado para coordenação e direção.');
      this.ocorrenciaForm.reset();
      this.router.navigate(['/ocorrencias']);
      
    } catch (erro) {
      console.error('Erro ao registrar:', erro);
      alert('Erro ao registrar ocorrência. Tente novamente.');
    } finally {
      this.loading = false;
    }
  }
  
  cancelarEnvio() {
    this.showConfirm = false;
  }
  
  voltar() {
    this.router.navigate(['/dashboard']);
  }

  onTipoEnsinoChange(tipoEnsino: string) {
    this.turmasFiltradas = this.turmasPorTipo[tipoEnsino] || [];
    this.ocorrenciaForm.patchValue({ turma: '' });
  }
}
