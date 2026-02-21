import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FirestoreService, Ocorrencia } from '../../services/firestore';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-lista-ocorrencias',
  imports: [CommonModule],
  templateUrl: './lista-ocorrencias.html',
  styleUrl: './lista-ocorrencias.scss',
})
export class ListaOcorrencias implements OnInit {
  
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  
  ocorrencias: Ocorrencia[] = [];
  loading = true;
  
  ngOnInit() {
    this.carregarOcorrencias();
  }
  
  async carregarOcorrencias() {
    try {
      this.loading = true;
      
      // Buscar escolaId do usuário logado
      const escolaId = await this.authService.getEscolaId();
      
      if (!escolaId) {
        alert('Erro: Usuário não vinculado a nenhuma escola. Contate o administrador.');
        this.loading = false;
        return;
      }
      
      this.ocorrencias = await this.firestoreService.buscarOcorrencias(escolaId);
      
      console.log('Ocorrências carregadas:', this.ocorrencias.length);
      console.log('Dados:', this.ocorrencias);
      
    } catch (error) {
      console.error('Erro ao carregar ocorrências:', error);
      alert('Erro ao carregar ocorrências');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
      console.log('Loading após finally:', this.loading);
    }
  }
  
  voltar() {
    this.router.navigate(['/dashboard']);
  }
  
  toggleExpansao(ocorrencia: Ocorrencia) {
    ocorrencia.expandido = !ocorrencia.expandido;
  }
}
