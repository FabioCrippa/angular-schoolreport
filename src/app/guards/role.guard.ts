import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth';
import { FirestoreService } from '../services/firestore';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

export const roleGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const firestoreService = inject(FirestoreService);
  const router = inject(Router);

  // Use reactive user$ instead of synchronous getCurrentUser() to avoid race
  // condition on mobile where Firebase auth state isn't hydrated yet
  const user = await firstValueFrom(authService.user$.pipe(take(1)));

  if (!user) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  try {
    const usuario = await firestoreService.buscarUsuario(user.uid);
    
    if (!usuario) {
      router.navigate(['/login']);
      return false;
    }

    const allowedRoles = route.data['roles'] as string[];
    
    if (!allowedRoles || allowedRoles.length === 0) {
      return true; // Sem restrição de role
    }

    if (allowedRoles.includes(usuario.role)) {
      return true;
    } else {
      router.navigate(['/dashboard']);
      return false;
    }
    
  } catch (error) {
    console.error('Erro ao verificar role:', error);
    router.navigate(['/login']);
    return false;
  }
};
