import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  private authService = inject(AuthService);
  private router = inject(Router);

  userName = '';
  userEmail = '';
  isAdmin = false;

  // Lista de emails de administradores
  private ADMIN_EMAILS = ['admin@escola.com'];

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.displayName || 'Professor';
      this.userEmail = user.email || '';
      
      // Verifica se o usuário é admin
      this.isAdmin = this.ADMIN_EMAILS.includes(user.email || '');
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
