import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../services/auth';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule} from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {

  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  loginForm: FormGroup;
  errorMessage = '';
  loading = false;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Preencha todos os campos corretamente.';
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const { email, password } = this.loginForm.value;
      await this.authService.loginWithEmail(email, password);
      // Se chegar aqui, login foi bem-sucedido e vai navegar
    } catch (error: any) {
      console.error('Erro no login:', error);
      this.loading = false;
      
      // Tratamento de erros específicos do Firebase
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/network-request-failed') {
        this.errorMessage = 'Email ou senha incorretos.';
      } else if (error.code === 'auth/too-many-requests') {
        this.errorMessage = 'Muitas tentativas de login. Tente novamente em alguns minutos.';
      } else if (error.code === 'auth/invalid-email') {
        this.errorMessage = 'Email inválido.';
      } else {
        this.errorMessage = 'Erro ao fazer login. Tente novamente.';
      }
      
      this.cdr.markForCheck();
    }
  }

  async loginWithGoogle() {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      await this.authService.loginWithGoogle();
    } catch (erro: any) {
      console.error('Erro no login com Google:', erro);
      this.errorMessage = 'Erro ao fazer login com Google. Tente novamente.';
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
