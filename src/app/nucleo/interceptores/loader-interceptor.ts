import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoaderService } from '../servicios/loader-service';

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {

  constructor(private loader: LoaderService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {

    // 👉 Cada petición que pasa por aquí enciende el loader
    this.loader.mostrar();

    return next.handle(req).pipe(
      finalize(() => {
        // 👉 Cuando termina (éxito o error), apagamos el loader
        this.loader.ocultar();
      }),
    );
  }
}
