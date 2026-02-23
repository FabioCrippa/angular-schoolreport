import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FirestoreService, ControleEntradaSaida } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-registrar-atraso',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './registrar-atraso.html',
  styleUrl: './registrar-atraso.scss',
})
export class RegistrarAtraso implements OnInit {
  
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  
  atrasoForm: FormGroup;
  loading = false;
  showConfirm = false;
  secretariaNome = 'Secretaria';
  
  // Opções de seleção
  tiposEnsino = ['Fundamental I', 'Fundamental II', 'Ensino Médio'];
  aulasPermitidas = ['2ª aula', '3ª aula', '4ª aula', '5ª aula', '6ª aula'];
  
  constructor() {
    const hoje = new Date().toISOString().split('T')[0];
    const agora = new Date().toTimeString().substring(0, 5);
    
    this.atrasoForm = this.fb.group({
      alunoNome: ['', Validators.required],
      turma: ['', Validators.required],
      tipoEnsino: ['', Validators.required],
      data: [hoje, Validators.required],
      horario: [agora, Validators.required],
      aulaPermitida: ['2ª aula', Validators.required],
      motivo: ['']
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
    if (this.atrasoForm.valid) {
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
      const formData = this.atrasoForm.value;
      const user = this.authService.getCurrentUser();
      const escolaId = await this.authService.getEscolaId();
      
      if (!escolaId) {
        alert('Erro: Usuário não vinculado a nenhuma escola.');
        this.loading = false;
        return;
      }
      
      const atraso: Omit<ControleEntradaSaida, 'id' | 'criadoEm'> = {
        escolaId: escolaId,
        tipo: 'atraso',
        alunoNome: formData.alunoNome,
        turma: formData.turma,
        tipoEnsino: formData.tipoEnsino,
        data: formData.data,
        horario: formData.horario,
        aulaPermitida: formData.aulaPermitida,
        motivo: formData.motivo || undefined,
        registradoPor: user?.email || 'secretaria@escola.com',
        registradoPorNome: this.secretariaNome
      };
      
      await this.firestoreService.adicionarControle(atraso);
      
      alert('Atraso registrado com sucesso!');
      this.atrasoForm.reset({
        data: new Date().toISOString().split('T')[0],
        horario: new Date().toTimeString().substring(0, 5),
        tipoEnsino: '',
        aulaPermitida: '2ª aula'
      });
      
    } catch (erro) {
      console.error('Erro ao registrar atraso:', erro);
      alert('Erro ao registrar atraso. Tente novamente.');
    } finally {
      this.loading = false;
    }
  }
}
