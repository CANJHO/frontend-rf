import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ServicioAutenticacion } from '../servicios/servicio-autenticacion';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(
    private servicioAutenticacion: ServicioAutenticacion,
    private router: Router,
  ) {}

  intercept(
    solicitud: HttpRequest<unknown>,
    siguiente: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const token = this.servicioAutenticacion.obtenerToken();

    if (token) {
      solicitud = solicitud.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    return siguiente.handle(solicitud).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Limpia sesión
          this.servicioAutenticacion.cerrarSesion();

          // 🚫 Kiosko es público: NO redirigir si estás en /kiosko
          const rutaActual = this.router.url || '';
          const esKiosko = rutaActual.startsWith('/kiosko');

          if (!esKiosko) {
            // ✅ Tu login real es /inicio-sesion
            this.router.navigate(['/inicio-sesion']);
          }
        }

        return throwError(() => error);
      }),
    );
  }
}

