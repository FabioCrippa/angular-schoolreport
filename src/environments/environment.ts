// Configurações do Firebase para PRODUÇÃO (Vercel)
// Este arquivo é usado quando fazemos build de produção (ng build)
export const environment = {
  production: true,  // Indica ambiente de produção
  vapidKey: 'BNuYgtIIj9_JY7CeMIs7QY0xdKpEEWEO_5f626KaSHDQa5tKlwZdLN6_IAso68QE9plKyJTqvnxptpul90Vc6Ig',
  
  // Mesmas credenciais (Firebase permite usar as mesmas)
  firebaseConfig: {
    apiKey: "AIzaSyCDvO-A2oz7H0QDco6rww38h6ntkWpDsB8",
    authDomain: "reportonclass.firebaseapp.com",
    projectId: "reportonclass",
    storageBucket: "reportonclass.firebasestorage.app",
    messagingSenderId: "429712751744",
    appId: "1:429712751744:web:fd7a05f0154120b1413a65"
  }
};