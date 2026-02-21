import { Injectable, inject } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { FirestoreService } from './firestore';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  
  private auth = inject(Auth);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  
  user$ = user(this.auth);
  
  private ADMIN_EMAILS = ['admin@escola.com'];
  
  private isAdmin(email: string | null): boolean {
    return email ? this.ADMIN_EMAILS.includes(email) : false;
  }
  
  async loginWithEmail(email: string, password: string) {
    try {
      const resultado = await signInWithEmailAndPassword(this.auth, email, password);
      
      // Redireciona admin para painel admin, usuários normais para dashboard
      if (this.isAdmin(resultado.user.email)) {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/dashboard']);
      }
      
      return resultado;
    } catch (erro: any) {
      console.error('Erro no login:', erro.message);
      throw erro;
    }
  }

  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const resultado = await signInWithPopup(this.auth, provider);
      
      // Redireciona admin para painel admin, usuários normais para dashboard
      if (this.isAdmin(resultado.user.email)) {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/dashboard']);
      }
      
      return resultado;
    } catch (erro: any) {
      console.error('Erro no login com Google:', erro.message);
      throw erro;
    }
  }

  async logout() {
    try {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    } catch (erro: any) {
      console.error('Erro no logout:', erro.message);
      throw erro;
    }
  }

  isLoggedIn(): boolean {
    return this.auth.currentUser !== null;
  }

  async criarContaComEmail(email: string, password: string): Promise<string> {
    try {
      console.log('📧 Tentando criar conta para:', email);
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      console.log('✅ Conta criada! UID:', userCredential.user.uid);
      return userCredential.user.uid;
    } catch (erro: any) {
      console.error('❌ Erro ao criar conta:', erro);
      console.error('Código do erro:', erro.code);
      console.error('Mensagem:', erro.message);
      throw erro;
    }
  }

  getCurrentUser() {
    return this.auth.currentUser;
  }

  async getEscolaId(): Promise<string | null> {
    const user = this.getCurrentUser();
    console.log('🔍 Buscando escolaId para usuário:', user?.uid);
    
    if (!user) {
      console.log('❌ Nenhum usuário logado');
      return null;
    }
    
    try {
      console.log('📡 Buscando documento do usuário no Firestore...');
      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      console.log('✅ Documento encontrado:', usuario);
      console.log('🏫 EscolaId:', usuario?.escolaId);
      return usuario?.escolaId || null;
    } catch (error) {
      console.error('❌ Erro ao buscar escolaId:', error);
      return null;
    }
  }
}
