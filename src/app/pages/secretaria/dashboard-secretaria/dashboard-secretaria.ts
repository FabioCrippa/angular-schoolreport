import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { FirestoreService } from '../../../services/firestore';

@Component({
  selector: 'app-dashboard-secretaria',
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard-secretaria.html',
  styleUrl: './dashboard-secretaria.scss',
})
export class DashboardSecretaria implements OnInit {
  
  private router = inject(Router);
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);
  private cdr = inject(ChangeDetectorRef);
  
  userName: string | null = null;
  loading = true;
  atrasosHoje = 0;
  saidasHoje = 0;
  dataHoje = '';
  
  ngOnInit() {
    this.carregarDados();
  }
  
  async carregarDados() {
    try {
      this.loading = true;
      const user = this.authService.getCurrentUser();
      
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }
      
      // Buscar nome do usuário no Firestore
      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      this.userName = usuario?.nome || user.displayName || user.email || 'Secretaria';
      
      // Buscar estatísticas do dia
      const escolaId = await this.authService.getEscolaId();
      if (escolaId) {
        const hoje = new Date().toISOString().split('T')[0];
        this.dataHoje = new Date().toLocaleDateString('pt-BR');
        
        const atrasos = await this.firestoreService.buscarControlesPorTipo(escolaId, 'atraso', hoje);
        const saidas = await this.firestoreService.buscarControlesPorTipo(escolaId, 'saida', hoje);
        
        this.atrasosHoje = atrasos.length;
        this.saidasHoje = saidas.length;
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
  
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  navegarPara(rota: string) {
    this.router.navigate([rota]);
  }
}
