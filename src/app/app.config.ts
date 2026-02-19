import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

// Imports do Firebase
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

// Importar configurações do ambiente
import { environment } from '../environments/environment.development';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes), 
    provideClientHydration(withEventReplay()),
    
    // Inicializar Firebase com as credenciais
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    
    // Fornecer serviço de Autenticação
    provideAuth(() => getAuth()),
    
    // Fornecer serviço de Firestore (banco de dados)
    provideFirestore(() => getFirestore())
  ]
};
