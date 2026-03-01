import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ServicioAutenticacion {

  private readonly apiUrl = 'http://localhost:3000/auth';
  private readonly tokenKey = 'token';
  private readonly usuarioKey = 'usuario';

  private usuarioActualSubject = new BehaviorSubject<any | null>(null);
  usuarioActual$ = this.usuarioActualSubject.asObservable();

  constructor(private http: HttpClient) {
    const usuarioGuardado = localStorage.getItem(this.usuarioKey);
    if (usuarioGuardado) {
      this.usuarioActualSubject.next(JSON.parse(usuarioGuardado));
    }
  }

  iniciarSesion(usuario: string, contrasenia: string): Observable<any> {
    const body = {
      documento: usuario,     // el DNI del formulario
      password: contrasenia,  // la contraseña
    };

    return this.http
      .post<any>(`${this.apiUrl}/login`, body)
      .pipe(
        tap((resp) => {
          // 🔹 Aquí tomamos tanto token como access_token
          const token = resp?.token ?? resp?.access_token;
          if (token) {
            localStorage.setItem(this.tokenKey, token);
          }

          if (resp?.usuario) {
            localStorage.setItem(this.usuarioKey, JSON.stringify(resp.usuario));
            this.usuarioActualSubject.next(resp.usuario);
          }
        }),
      );
  }

  obtenerToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  obtenerUsuario(): any | null {
    return this.usuarioActualSubject.value;
  }

  cerrarSesion(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.usuarioKey);
    this.usuarioActualSubject.next(null);
  }

  estaAutenticado(): boolean {
    return !!this.obtenerToken();
  }
}

