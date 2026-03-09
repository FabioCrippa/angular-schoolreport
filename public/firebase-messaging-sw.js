importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCDvO-A2oz7H0QDco6rww38h6ntkWpDsB8",
  authDomain: "reportonclass.firebaseapp.com",
  projectId: "reportonclass",
  storageBucket: "reportonclass.firebasestorage.app",
  messagingSenderId: "429712751744",
  appId: "1:429712751744:web:fd7a05f0154120b1413a65"
});

const messaging = firebase.messaging();

// Recebe mensagens quando o app está em segundo plano ou fechado
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Nova Ocorrência — escu';
  const options = {
    body: payload.notification?.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    data: payload.data,
    vibrate: [200, 100, 200]
  };

  return self.registration.showNotification(title, options);
});

// Ao clicar na notificação, abre o app na página de ocorrências
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/ocorrencias';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
