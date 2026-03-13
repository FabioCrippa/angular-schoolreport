import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

// Silencia console.log/warn em produção para evitar vazamento de dados sensíveis
if (environment.production) {
  window.console.log = () => {};
  window.console.warn = () => {};
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
