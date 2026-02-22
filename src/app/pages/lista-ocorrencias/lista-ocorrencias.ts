import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FirestoreService, Ocorrencia } from '../../services/firestore';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-lista-ocorrencias',
  imports: [CommonModule, RouterModule, FormsModule],
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
  ocorrenciasFiltradas: Ocorrencia[] = [];
  loading = true;
  isAdmin = false;
  userRole: 'professor' | 'coordenacao' | 'direcao' | null = null;
  userName: string | null = null;
  
  // Filtros
  filtroAluno = '';
  filtroProfessor = '';
  filtroGravidade = '';
  professoresUnicos: string[] = [];

  private ADMIN_EMAILS = ['professor@escola.com'];
  
  ngOnInit() {
    // Verifica se o usuário é admin
    const user = this.authService.getCurrentUser();
    if (user) {
      this.isAdmin = this.ADMIN_EMAILS.includes(user.email || '');
      this.userName = user.displayName || user.email || null;
    }
    
    this.carregarDadosUsuario();
  }
  
  async carregarDadosUsuario() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;
      
      // Buscar dados do usuário no Firestore para pegar o role
      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      if (usuario) {
        this.userRole = usuario.role;
        console.log('Role do usuário:', this.userRole);
      }
      
      // Carrega ocorrências após saber o role
      await this.carregarOcorrencias();
      
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      await this.carregarOcorrencias(); // Tenta carregar mesmo com erro
    }
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
      
      // Busca todas as ocorrências da escola
      const todasOcorrencias = await this.firestoreService.buscarOcorrencias(escolaId);
      
      // Ordena por data: mais recentes primeiro
      todasOcorrencias.sort((a, b) => {
        const dataA = new Date(a.data).getTime();
        const dataB = new Date(b.data).getTime();
        return dataB - dataA; // Ordem decrescente (mais nova para mais velha)
      });
      
      // Se for professor, filtra apenas suas ocorrências
      // Se for coordenação ou direção, mostra todas
      if (this.userRole === 'professor') {
        const user = this.authService.getCurrentUser();
        this.ocorrencias = todasOcorrencias.filter(
          occ => occ.professorEmail === user?.email
        );
        console.log('Ocorrências do professor carregadas:', this.ocorrencias.length);
      } else {
        this.ocorrencias = todasOcorrencias;
        
        // Extrai lista única de professores para o filtro
        const professoresSet = new Set<string>();
        this.ocorrencias.forEach(occ => {
          if (occ.professorNome) {
            professoresSet.add(occ.professorNome);
          }
        });
        this.professoresUnicos = Array.from(professoresSet).sort();
        
        console.log('Todas as ocorrências da escola carregadas:', this.ocorrencias.length);
        console.log('Professores únicos:', this.professoresUnicos);
      }
      
      // Inicializa lista filtrada
      this.aplicarFiltros();
      
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
  
  aplicarFiltros() {
    this.ocorrenciasFiltradas = this.ocorrencias.filter(occ => {
      // Filtro por aluno
      const matchAluno = !this.filtroAluno || 
        occ.nomeAluno.toLowerCase().includes(this.filtroAluno.toLowerCase());
      
      // Filtro por professor
      const matchProfessor = !this.filtroProfessor || 
        occ.professorNome === this.filtroProfessor;
      
      // Filtro por gravidade
      const matchGravidade = !this.filtroGravidade || 
        occ.gravidade === this.filtroGravidade;
      
      return matchAluno && matchProfessor && matchGravidade;
    });
    
    console.log('Filtros aplicados:', {
      aluno: this.filtroAluno,
      professor: this.filtroProfessor,
      gravidade: this.filtroGravidade,
      resultados: this.ocorrenciasFiltradas.length
    });
  }
  
  limparFiltros() {
    this.filtroAluno = '';
    this.filtroProfessor = '';
    this.filtroGravidade = '';
    this.aplicarFiltros();
  }
}
