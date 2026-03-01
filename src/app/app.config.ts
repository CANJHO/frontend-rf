import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { provideRouter} from '@angular/router';
import { rutasAplicacion } from './app.routes';

import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';

import { TokenInterceptor } from './nucleo/interceptores/token-interceptor';
import { LoaderInterceptor } from './nucleo/interceptores/loader-interceptor';
import { LoaderService } from './nucleo/servicios/loader-service';


export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection(),
    { provide: LOCALE_ID, useValue: 'es-PE' },
    // Rutas
    provideRouter(rutasAplicacion),
    

    // HttpClient usando interceptores de DI
    provideHttpClient(withInterceptorsFromDi()),

    // Servicio del loader (por si NO tiene providedIn:'root')
    LoaderService,

    // Interceptor del loader global
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoaderInterceptor,
      multi: true,
    },

    // Interceptor del token
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi: true,
    },
   
  ],
};

