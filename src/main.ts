import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeEsPe from '@angular/common/locales/es-PE';

import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';

// ✅ Registrar locale ES-PE para DatePipe y formatos en español Perú
registerLocaleData(localeEsPe);

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));