import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FirestoreService, ControleEntradaSaida } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-registrar-saida',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './registrar-saida.html',
  styleUrl: './registrar-saida.scss',
})
export class RegistrarSaida implements OnInit {
  
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  
  saidaForm: FormGroup;
  loading = false;
  showConfirm = false;
  secretariaNome = 'Secretaria';
  
  // Opções de seleção
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
  
  constructor() {
    const hoje = new Date().toISOString().split('T')[0];
    const agora = new Date().toTimeString().substring(0, 5);
    
    this.saidaForm = this.fb.group({
      alunoNome: ['', Validators.required],
      turma: ['', Validators.required],
      tipoEnsino: ['', Validators.required],
      data: [hoje, Validators.required],
      horario: [agora, Validators.required],
      motivo: ['', Validators.required],
      responsavel: ['', Validators.required],
      documentoResponsavel: ['', Validators.required]
    });
  }
  
  ngOnInit() {
    this.carregarNomeSecretaria();
  }
  
  async carregarNomeSecretaria() {
    try {
      const user = this.authService.getCurrentUser();
      if (user) {
        const usuario = await this.firestoreService.buscarUsuario(user.uid);
        if (usuario) {
          this.secretariaNome = usuario.nome;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar nome da secretaria:', error);
    }
  }
  
  voltar() {
    this.router.navigate(['/secretaria/dashboard']);
  }
  
  confirmar() {
    if (this.saidaForm.valid) {
      this.showConfirm = true;
    } else {
      alert('Preencha todos os campos obrigatórios.');
    }
  }
  
  cancelarConfirmacao() {
    this.showConfirm = false;
  }
  
  onTipoEnsinoChange(tipoEnsino: string) {
    this.turmasFiltradas = this.turmasPorTipo[tipoEnsino] || [];
    this.saidaForm.patchValue({ turma: '' });
  }
  
  async confirmarRegistro() {
    this.showConfirm = false;
    this.loading = true;
    
    try {
      const formData = this.saidaForm.value;
      const user = this.authService.getCurrentUser();
      const escolaId = await this.authService.getEscolaId();
      
      if (!escolaId) {
        alert('Erro: Usuário não vinculado a nenhuma escola.');
        this.loading = false;
        return;
      }
      
      const saida: Omit<ControleEntradaSaida, 'id' | 'criadoEm'> = {
        escolaId: escolaId,
        tipo: 'saida',
        alunoNome: formData.alunoNome,
        turma: formData.turma,
        tipoEnsino: formData.tipoEnsino,
        data: formData.data,
        horario: formData.horario,
        motivo: formData.motivo,
        responsavel: formData.responsavel,
        documentoResponsavel: formData.documentoResponsavel,
        registradoPor: user?.email || 'secretaria@escola.com',
        registradoPorNome: this.secretariaNome
      };
      
      await this.firestoreService.adicionarControle(saida);
      
      alert('Saída registrada com sucesso!');
      this.saidaForm.reset({
        data: new Date().toISOString().split('T')[0],
        horario: new Date().toTimeString().substring(0, 5),
        tipoEnsino: ''
      });
      this.turmasFiltradas = [];
      
    } catch (erro) {
      console.error('Erro ao registrar saída:', erro);
      alert('Erro ao registrar saída. Tente novamente.');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
