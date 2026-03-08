import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { FirestoreService } from '../../services/firestore';

@Component({
  selector: 'app-direcao-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './direcao-header.html',
  styleUrl: './direcao-header.scss',
})
export class DirecaoHeaderComponent implements OnInit {
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);
  private router = inject(Router);

  userRole = '';
  userName = '';
  userEmail = '';

  ngOnInit() {
    this.carregar();
  }

  async carregar() {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.userEmail = user.email || '';
    const usuario = await this.firestoreService.buscarUsuario(user.uid);
    this.userRole = usuario?.role || '';
    this.userName = usuario?.nome || user.displayName || user.email || '';
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
