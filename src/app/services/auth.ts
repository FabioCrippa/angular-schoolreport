import { Injectable, inject } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { FirestoreService } from './firestore';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  
  private auth = inject(Auth);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  
  user$ = user(this.auth);
  
  async loginWithEmail(email: string, password: string) {
    try {
      const resultado = await signInWithEmailAndPassword(this.auth, email, password);
      this.router.navigate(['/dashboard']);
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
      this.router.navigate(['/dashboard']);
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

  getCurrentUser() {
    return this.auth.currentUser;
  }

  async getEscolaId(): Promise<string | null> {
    const user = this.getCurrentUser();
    if (!user) return null;
    
    try {
      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      return usuario?.escolaId || null;
    } catch (error) {
      console.error('Erro ao buscar escolaId:', error);
      return null;
    }
  }
}
