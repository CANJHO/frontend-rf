import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ServicioAreas {

  private urlApi = 'http://localhost:3000/areas';

  constructor(private http: HttpClient) {}

  // Listar todas las áreas 
  listar(q?: string): Observable<any[]> {
    const url = q
      ? `${this.urlApi}?q=${encodeURIComponent(q)}`
      : this.urlApi;
    return this.http.get<any[]>(url);
  }

  // Solo activas → para combos (usuarios)
  listarActivas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.urlApi}/activas`);
  }

  // Obtener una área específica (por si lo necesitas luego)
  obtener(id: string): Observable<any> {
    return this.http.get<any>(`${this.urlApi}/${id}`);
  }

  // Crear área
  crear(datos: any): Observable<any> {
    return this.http.post<any>(this.urlApi, datos);
  }

  // Actualizar área
  actualizar(id: string, datos: any): Observable<any> {
    return this.http.put<any>(`${this.urlApi}/${id}`, datos);
  }

  // Desactivar área (baja lógica)
  desactivar(id: string): Observable<any> {
    return this.http.put<any>(`${this.urlApi}/${id}/desactivar`, {});
  }
}
