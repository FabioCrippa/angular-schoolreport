import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { FirestoreService } from '../../services/firestore';
import { doc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-primeiro-acesso',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './primeiro-acesso.html',
  styleUrl: './primeiro-acesso.scss',
})
export class PrimeiroAcesso {
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  email = '';
  senha = '';
  confirmarSenha = '';
  processando = false;
  mensagemErro = '';
  etapa: 'email' | 'senha' = 'email';
  usuarioEncontrado: any = null;

  async verificarEmail() {
    if (!this.email) {
      this.mensagemErro = 'Digite seu email.';
      return;
    }

    try {
      this.processando = true;
      this.mensagemErro = '';

      // Autentica anonimamente para permitir a query ao Firestore
      // (o usuário ainda não tem conta — a sessão anônima é descartada ao criar a conta)
      await this.authService.loginAnonimo();

      const usuario = await this.firestoreService.buscarUsuarioPorEmail(this.email);
      
      if (!usuario) {
        this.mensagemErro = 'Email não encontrado. Entre em contato com o administrador da sua escola.';
        this.processando = false;
        this.cdr.detectChanges();
        return;
      }

      if (!usuario.ativo) {
        this.mensagemErro = 'Este usuário está inativo. Entre em contato com o administrador.';
        this.processando = false;
        this.cdr.detectChanges();
        return;
      }

      this.usuarioEncontrado = usuario;
      this.etapa = 'senha';
      this.cdr.detectChanges();
      
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.code === 'PERMISSION_DENIED') {
        this.mensagemErro = 'Erro de permissão ao buscar o email. Contate o administrador.';
      } else {
        this.mensagemErro = `Erro: ${error?.message || 'Erro desconhecido'}`;
      }
      this.processando = false;
      this.cdr.detectChanges();
    } finally {
      this.processando = false;
      this.cdr.detectChanges();
    }
  }

  async criarConta() {
    if (!this.senha || !this.confirmarSenha) {
      this.mensagemErro = 'Preencha todos os campos.';
      return;
    }

    if (this.senha.length < 6) {
      this.mensagemErro = 'A senha deve ter no mínimo 6 caracteres.';
      return;
    }

    if (this.senha !== this.confirmarSenha) {
      this.mensagemErro = 'As senhas não conferem.';
      return;
    }

    try {
      this.processando = true;
      this.mensagemErro = '';
      
      console.log('🔐 Criando conta no Firebase Auth...');
      // Tenta criar conta no Firebase Auth
      let uid: string;
      try {
        uid = await this.authService.criarContaComEmail(this.email, this.senha);
        console.log('✅ Conta Auth criada com UID:', uid);
      } catch (createError: any) {
        // Se a conta já existe, tenta fazer login
        if (createError.code === 'auth/email-already-in-use') {
          console.log('⚠️ Conta já existe, fazendo login...');
          await this.authService.loginWithEmail(this.email, this.senha, false);
          const user = this.authService.getCurrentUser();
          if (!user) {
            throw new Error('Login falhou após criação de conta');
          }
          uid = user.uid;
          console.log('✅ Login realizado com UID:', uid);
        } else {
          throw createError; // Outro erro, propaga
        }
      }
      
      console.log('📝 Criando documento no Firestore com UID:', uid);
      
      // Remove o documento temporário ANTES de criar o novo (evita duplicação)
      if (this.usuarioEncontrado.docId && this.usuarioEncontrado.docId !== uid) {
        try {
          console.log('🗑️ Removendo documento temporário:', this.usuarioEncontrado.docId);
          await this.firestoreService.deletarUsuario(this.usuarioEncontrado.docId);
          console.log('✅ Documento temporário removido com sucesso');
        } catch (deleteError) {
          console.error('⚠️ Erro ao remover documento temporário:', deleteError);
          // Continua mesmo se falhar a exclusão
        }
      }
      
      // Cria documento definitivo com o UID do Auth
      await this.firestoreService.adicionarUsuarioComId(uid, {
        email: this.usuarioEncontrado.email,
        nome: this.usuarioEncontrado.nome,
        escolaId: this.usuarioEncontrado.escolaId,
        role: this.usuarioEncontrado.role,
        ativo: this.usuarioEncontrado.ativo
      });
      console.log('✅ Documento definitivo criado com UID:', uid)
      
      // Verifica se já está logado, senão faz login
      let currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        console.log('🔑 Fazendo login...');
        await this.authService.loginWithEmail(this.email, this.senha, false);
        console.log('✅ Login realizado');
      }
      
      console.log('🎉 Processo concluído com sucesso!');
      
      // Reseta loading antes de redirecionar
      this.processando = false;
      
      // Redireciona para dashboard
      alert('Conta configurada com sucesso! Você já está logado.');
      this.router.navigate(['/dashboard']);
      
    } catch (error: any) {
      console.error('❌ Erro ao criar conta:', error);
      console.error('Código completo:', error.code);
      console.error('Mensagem completa:', error.message);
      
      // Tratamento de erros específicos
      if (error.code === 'auth/invalid-email') {
        this.mensagemErro = 'Email inválido.';
        this.processando = false;
      } else if (error.code === 'auth/weak-password') {
        this.mensagemErro = 'Senha muito fraca. Use no mínimo 6 caracteres.';
        this.processando = false;
      } else if (error.code === 'auth/network-request-failed') {
        this.mensagemErro = 'Erro de conexão. Verifique sua internet e tente novamente.';
        this.processando = false;
      } else if (error.code === 'auth/email-already-in-use') {
        this.mensagemErro = 'Este email já possui uma conta. Tente fazer login na página inicial.';
        this.processando = false;
      } else if (error.code === 'permission-denied') {
        console.error('🔒 ERRO DE PERMISSÃO - Verifique as Firestore Rules!');
        this.mensagemErro = 'Erro de permissão ao criar documento. Contate o administrador.';
        this.processando = false;
      } else {
        this.mensagemErro = `Erro ao criar conta: ${error.message || 'Tente novamente.'}`;
        this.processando = false;
      }
    } finally {
      // Garantir que sempre reseta (caso não tenha sido resetado antes)
      this.processando = false;
      this.cdr.detectChanges();
    }
  }

  voltarParaEmail() {
    this.etapa = 'email';
    this.senha = '';
    this.confirmarSenha = '';
    this.mensagemErro = '';
    this.cdr.detectChanges();
  }
}
