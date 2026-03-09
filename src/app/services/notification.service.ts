import { Injectable, inject } from '@angular/core';
import { Messaging, getToken, onMessage } from '@angular/fire/messaging';
import { Firestore, collection, query, where, getDocs, updateDoc, doc, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { environment } from '../../environments/environment.development';

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private messaging = inject(Messaging);
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  async configurar(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Permissão de notificação negada');
        return;
      }

      // Registrar o service worker do FCM explicitamente
      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      const token = await getToken(this.messaging, {
        vapidKey: environment.vapidKey,
        serviceWorkerRegistration: swReg
      });

      if (!token) {
        console.warn('Não foi possível obter token FCM');
        return;
      }

      const user = this.auth.currentUser;
      if (!user) return;

      // Salvar token — tenta primeiro pelo UID, senão busca por email
      await this.salvarToken(user.uid, user.email!, token);
      console.log('Token FCM registrado com sucesso');

    } catch (err) {
      console.error('Erro ao configurar notificações push:', err);
    }
  }

  private async salvarToken(uid: string, email: string, token: string): Promise<void> {
    // Tenta atualizar doc pelo UID primeiro
    try {
      await setDoc(doc(this.firestore, 'usuarios', uid), { fcmToken: token }, { merge: true });
      return;
    } catch {
      // doc por UID não existe, busca por email
    }

    // Fallback: busca doc por email
    const snap = await getDocs(
      query(collection(this.firestore, 'usuarios'), where('email', '==', email))
    );
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, { fcmToken: token });
    }
  }

  escutarMensagensForeground(): void {
    if (typeof window === 'undefined') return;

    onMessage(this.messaging, (payload) => {
      if (!payload.notification) return;

      const { title = 'Nova Ocorrência — escu', body } = payload.notification;

      new Notification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
      });
    });
  }
}
