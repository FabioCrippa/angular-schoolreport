import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  
  private router = inject(Router);
  
  irParaLogin() {
    this.router.navigate(['/login']);
  }
  
  solicitarDemo() {
    // Altere o número do WhatsApp para o seu
    const telefone = '5511999999999'; // Formato: 55 (país) + DDD + número
    const mensagem = encodeURIComponent('Olá! Gostaria de solicitar uma demonstração do SchoolReport.');
    window.open(`https://wa.me/${telefone}?text=${mensagem}`, '_blank');
  }
}
