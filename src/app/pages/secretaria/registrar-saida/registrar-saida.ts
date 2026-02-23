import { Component, inject, OnInit } from '@angular/core';
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
  
  saidaForm: FormGroup;
  loading = false;
  showConfirm = false;
  secretariaNome = 'Secretaria';
  
  // Opções de seleção
  tiposEnsino = ['Fundamental I', 'Fundamental II', 'Ensino Médio'];
  
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
      
    } catch (erro) {
      console.error('Erro ao registrar saída:', erro);
      alert('Erro ao registrar saída. Tente novamente.');
    } finally {
      this.loading = false;
    }
  }
}
