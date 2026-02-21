import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirestoreService, Escola, Usuario } from '../../services/firestore';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  private firestoreService = inject(FirestoreService);
  authService = inject(AuthService);
  
  escolas: Escola[] = [];
  carregandoEscolas = false;
  erroCarregar = '';
  
  // Usuário autenticado
  userEmail: string | null = null;
  
  // Modal de adicionar/editar escola
  mostrarModalNovaEscola = false;
  salvandoEscola = false;
  modoEdicao = false;
  escolaEditandoId: string | null = null;
  novaEscola = {
    nome: '',
    emailDirecao: '',
    emailCoordenacao: '',
    status: 'ativo' as 'ativo' | 'inativo',
    plano: 'mensal' as 'mensal' | 'anual' | 'trial'
  };

  // Modal de gerenciar usuários
  mostrarModalUsuarios = false;
  escolaSelecionada: Escola | null = null;
  usuarios: Usuario[] = [];
  carregandoUsuarios = false;
  mostrarFormUsuario = false;
  salvandoUsuario = false;
  modoEdicaoUsuario = false;
  usuarioEditandoId: string | null = null;
  novoUsuario = {
    email: '',
    nome: '',
    role: 'professor' as 'professor' | 'coordenacao' | 'direcao',
    ativo: true
  };

  ngOnInit() {
    // Observa o usuário autenticado e só carrega escolas quando Auth estiver pronto
    this.authService.user$.subscribe(user => {
      this.userEmail = user?.email || null;
      
      // Só carrega escolas se o usuário estiver autenticado
      if (user) {
        console.log('Usuário autenticado, carregando escolas...', user.email);
        this.carregarEscolas();
      } else {
        console.log('Usuário NÃO autenticado');
        this.erroCarregar = 'Você precisa estar logado para acessar o painel admin.';
      }
    });
  }

  async carregarEscolas() {
    try {
      this.carregandoEscolas = true;
      this.erroCarregar = '';
      
      console.log('Tentando buscar escolas...');
      console.log('Usuário atual:', this.authService.getCurrentUser()?.email);
      
      this.escolas = await this.firestoreService.buscarTodasEscolas();
      
      console.log('Escolas carregadas com sucesso:', this.escolas.length);
    } catch (error: any) {
      console.error('Erro ao carregar escolas:', error);
      console.error('Código do erro:', error.code);
      console.error('Mensagem:', error.message);
      
      this.erroCarregar = `Erro ao carregar escolas: ${error.code || 'Desconhecido'}`;
    } finally {
      this.carregandoEscolas = false;
    }
  }

  abrirModalNovaEscola() {
    this.modoEdicao = false;
    this.escolaEditandoId = null;
    this.mostrarModalNovaEscola = true;
    this.resetarFormEscola();
  }

  abrirModalEditarEscola(escola: Escola) {
    this.modoEdicao = true;
    this.escolaEditandoId = escola.id || null;
    this.mostrarModalNovaEscola = true;
    
    // Preenche o formulário com os dados da escola
    this.novaEscola = {
      nome: escola.nome,
      emailDirecao: escola.emailDirecao,
      emailCoordenacao: escola.emailCoordenacao,
      status: escola.status,
      plano: escola.plano
    };
  }

  fecharModalNovaEscola() {
    this.mostrarModalNovaEscola = false;
    this.modoEdicao = false;
    this.escolaEditandoId = null;
    this.resetarFormEscola();
  }

  resetarFormEscola() {
    this.novaEscola = {
      nome: '',
      emailDirecao: '',
      emailCoordenacao: '',
      status: 'ativo',
      plano: 'mensal'
    };
  }

  async salvarNovaEscola() {
    if (!this.novaEscola.nome || !this.novaEscola.emailDirecao) {
      console.error('Preencha pelo menos o nome e email da direção.');
      return;
    }

    try {
      this.salvandoEscola = true;
      
      if (this.modoEdicao && this.escolaEditandoId) {
        // Atualizar escola existente
        await this.firestoreService.atualizarEscola(this.escolaEditandoId, this.novaEscola);
        console.log('Escola atualizada com sucesso!');
      } else {
        // Adicionar nova escola
        await this.firestoreService.adicionarEscola(this.novaEscola);
        console.log('Escola adicionada com sucesso!');
      }
      
      this.fecharModalNovaEscola();
      await this.carregarEscolas();
    } catch (error) {
      console.error('Erro ao salvar escola:', error);
    } finally {
      this.salvandoEscola = false;
    }
  }

  async deletarEscola(escola: Escola) {
    const confirmacao = confirm(`Tem certeza que deseja deletar a escola "${escola.nome}"?\n\nEsta ação não pode ser desfeita!`);
    
    if (!confirmacao) return;

    try {
      if (!escola.id) {
        console.error('ID da escola não encontrado');
        return;
      }
      
      await this.firestoreService.deletarEscola(escola.id);
      console.log('Escola deletada com sucesso!');
      await this.carregarEscolas();
    } catch (error) {
      console.error('Erro ao deletar escola:', error);
    }
  }

  // ========== MÉTODOS DE GERENCIAR USUÁRIOS ==========

  async abrirModalUsuarios(escola: Escola) {
    this.escolaSelecionada = escola;
    this.mostrarModalUsuarios = true;
    this.mostrarFormUsuario = false;
    await this.carregarUsuarios();
  }

  fecharModalUsuarios() {
    this.mostrarModalUsuarios = false;
    this.escolaSelecionada = null;
    this.usuarios = [];
    this.mostrarFormUsuario = false;
    this.resetarFormUsuario();
  }

  async carregarUsuarios() {
    if (!this.escolaSelecionada?.id) {
      console.log('❌ Nenhuma escola selecionada');
      return;
    }

    try {
      console.log('🔍 Carregando usuários da escola:', this.escolaSelecionada.nome, this.escolaSelecionada.id);
      this.carregandoUsuarios = true;
      this.usuarios = await this.firestoreService.listarUsuariosPorEscola(this.escolaSelecionada.id);
      console.log('✅ Usuários carregados:', this.usuarios.length, this.usuarios);
    } catch (error) {
      console.error('❌ Erro ao carregar usuários:', error);
    } finally {
      this.carregandoUsuarios = false;
    }
  }

  abrirFormNovoUsuario() {
    this.modoEdicaoUsuario = false;
    this.usuarioEditandoId = null;
    this.mostrarFormUsuario = true;
    this.resetarFormUsuario();
  }

  abrirFormEditarUsuario(usuario: Usuario) {
    this.modoEdicaoUsuario = true;
    this.usuarioEditandoId = usuario.id || null;
    this.mostrarFormUsuario = true;
    
    this.novoUsuario = {
      email: usuario.email,
      nome: usuario.nome,
      role: usuario.role,
      ativo: usuario.ativo
    };
  }

  fecharFormUsuario() {
    this.mostrarFormUsuario = false;
    this.modoEdicaoUsuario = false;
    this.usuarioEditandoId = null;
    this.resetarFormUsuario();
  }

  resetarFormUsuario() {
    this.novoUsuario = {
      email: '',
      nome: '',
      role: 'professor',
      ativo: true
    };
  }

  async salvarUsuario() {
    if (!this.novoUsuario.email || !this.novoUsuario.nome || !this.escolaSelecionada?.id) {
      console.error('Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      this.salvandoUsuario = true;
      
      if (this.modoEdicaoUsuario && this.usuarioEditandoId) {
        // Atualizar usuário existente
        await this.firestoreService.atualizarUsuario(this.usuarioEditandoId, this.novoUsuario);
        console.log('Usuário atualizado com sucesso!');
      } else {
        // Adicionar novo usuário
        await this.firestoreService.adicionarUsuarioFirestore({
          ...this.novoUsuario,
          escolaId: this.escolaSelecionada.id
        });
        console.log('Usuário adicionado com sucesso!');
      }
      
      this.fecharFormUsuario();
      await this.carregarUsuarios();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
    } finally {
      this.salvandoUsuario = false;
    }
  }

  async deletarUsuario(usuario: Usuario) {
    const confirmacao = confirm(`Tem certeza que deseja deletar o usuário "${usuario.nome}"?\n\nEsta ação não pode ser desfeita!`);
    
    if (!confirmacao) return;

    try {
      if (!usuario.id) {
        console.error('ID do usuário não encontrado');
        return;
      }
      
      await this.firestoreService.deletarUsuario(usuario.id);
      console.log('Usuário deletado com sucesso!');
      await this.carregarUsuarios();
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
    }
  }

  copiarLinkPrimeiroAcesso() {
    const link = `${window.location.origin}/primeiro-acesso`;
    
    navigator.clipboard.writeText(link).then(() => {
      alert('Link copiado para a área de transferência!\n\n' + link);
    }).catch(err => {
      console.error('Erro ao copiar link:', err);
      alert('Erro ao copiar link. Link: ' + link);
    });
  }
}
