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

    console.log('🔍 Verificando email:', this.email);

    try {
      this.processando = true;
      this.mensagemErro = '';
      
      console.log('📡 Buscando usuário no Firestore...');
      // Busca usuário no Firestore
      const usuario = await this.firestoreService.buscarUsuarioPorEmail(this.email);
      console.log('✅ Resposta do Firestore:', usuario);
      
      if (!usuario) {
        console.log('❌ Usuário não encontrado');
        this.mensagemErro = 'Email não encontrado. Entre em contato com o administrador da sua escola.';
        this.processando = false;
        return;
      }

      if (!usuario.ativo) {
        console.log('❌ Usuário inativo');
        this.mensagemErro = 'Este usuário está inativo. Entre em contato com o administrador.';
        this.processando = false;
        return;
      }

      // Email encontrado, permitir definir senha
      console.log('✅ Email encontrado! Avançando para senha...');
      this.usuarioEncontrado = usuario;
      this.etapa = 'senha';
      this.cdr.detectChanges();
      
    } catch (error: any) {
      console.error('❌ ERRO ao verificar email:', error);
      console.error('Código do erro:', error?.code);
      console.error('Mensagem do erro:', error?.message);
      this.mensagemErro = `Erro: ${error?.message || 'Erro desconhecido'}`;
    } finally {
      console.log('🏁 Finally executado');
      this.processando = false;
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
      // 1. Cria conta no Firebase Auth
      const uid = await this.authService.criarContaComEmail(this.email, this.senha);
      console.log('✅ Conta Auth criada com UID:', uid);
      
      console.log('� Criando documento no Firestore com UID correto...');
      // 2. Cria documento do usuário no Firestore com o UID do Auth
      await this.firestoreService.adicionarUsuarioComId(uid, {
        email: this.usuarioEncontrado.email,
        nome: this.usuarioEncontrado.nome,
        escolaId: this.usuarioEncontrado.escolaId,
        role: this.usuarioEncontrado.role,
        ativo: this.usuarioEncontrado.ativo
      });
      console.log('✅ Documento Firestore criado');
      
      console.log('🗑️ Removendo documento temporário...');
      // 3. Remove o documento inicial criado pelo admin
      await this.firestoreService.deletarUsuario(this.usuarioEncontrado.docId);
      console.log('✅ Documento temporário removido');
      
      console.log('🔑 Fazendo login automático...');
      // 4. Faz login automático (sem redirecionar ainda)
      await this.authService.loginWithEmail(this.email, this.senha, false);
      console.log('✅ Login automático realizado');
      
      console.log('🎉 Conta criada com sucesso!');
      
      // Redireciona para dashboard (já está logado)
      alert('Conta criada com sucesso! Você já está logado.');
      this.router.navigate(['/dashboard']);
      
    } catch (error: any) {
      console.error('❌ Erro ao criar conta:', error);
      console.error('Código completo:', error.code);
      
      if (error.code === 'auth/email-already-in-use') {
        console.log('⚠️ Email já tem conta. Tentando login e atualização...');
        
        try {
          // Tenta fazer login
          await this.authService.loginWithEmail(this.email, this.senha);
          console.log('✅ Login realizado');
          
          // Pega o UID do usuário logado
          const user = this.authService.getCurrentUser();
          if (user) {
            console.log('📝 Verificando se precisa criar documento...');
            
            // Tenta criar o documento com o UID
            await this.firestoreService.adicionarUsuarioComId(user.uid, {
              email: this.usuarioEncontrado.email,
              nome: this.usuarioEncontrado.nome,
              escolaId: this.usuarioEncontrado.escolaId,
              role: this.usuarioEncontrado.role,
              ativo: this.usuarioEncontrado.ativo
            });
            
            // Remove documento temporário
            await this.firestoreService.deletarUsuario(this.usuarioEncontrado.docId);
            
            console.log('🎉 Configuração concluída!');
            alert('Conta já existia. Você já está logado!');
            this.router.navigate(['/dashboard']);
            return;
          }
        } catch (loginError: any) {
          console.error('Erro no login alternativo:', loginError);
          this.mensagemErro = 'Este email já possui uma conta, mas a senha está incorreta.';
        }
      } else if (error.code === 'auth/invalid-email') {
        this.mensagemErro = 'Email inválido.';
      } else if (error.code === 'auth/weak-password') {
        this.mensagemErro = 'Senha muito fraca. Use no mínimo 6 caracteres.';
      } else {
        this.mensagemErro = `Erro ao criar conta: ${error.message || 'Tente novamente.'}`;
      }
    } finally {
      this.processando = false;
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
