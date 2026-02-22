import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../services/auth';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FirestoreService } from '../../services/firestore';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  private authService = inject(AuthService);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  private cdr = inject(ChangeDetectorRef);

  userName = '';
  userEmail = '';
  isAdmin = false;
  userRole: 'professor' | 'coordenacao' | 'direcao' | null = null;
  loading = true;

  // Lista de emails de administradores
  private ADMIN_EMAILS = ['admin@escola.com'];

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.displayName || 'Professor';
      this.userEmail = user.email || '';
      
      // Verifica se o usuário é admin
      this.isAdmin = this.ADMIN_EMAILS.includes(user.email || '');
      
      // Busca o role do usuário
      this.carregarDadosUsuario();
    } else {
      this.loading = false;
    }
  }
  
  async carregarDadosUsuario() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.loading = false;
        return;
      }
      
      // Buscar dados do usuário no Firestore para pegar o role
      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      if (usuario) {
        this.userRole = usuario.role;
        this.userName = usuario.nome || this.userName;
        console.log('Role do usuário:', this.userRole);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
      console.log('Dashboard loading finalizado:', this.loading, 'Role:', this.userRole);
    }
  }

  logout() {
    this.authService.logout();
  }

  goToRegistro() {
    this.router.navigate(['/registro']);
  }

  goToOcorrencias() {
    this.router.navigate(['/ocorrencias']);
  }
}
