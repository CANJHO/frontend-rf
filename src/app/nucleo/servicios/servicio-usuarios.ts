import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class ServicioUsuarios {
  private urlApi = `${API_BASE_URL}/usuarios`;

  constructor(private http: HttpClient) {}

  // ✅ Rompe cache agregando _ts
  private withTs(url: string): string {
    const ts = Date.now();
    return url.includes('?') ? `${url}&_ts=${ts}` : `${url}?_ts=${ts}`;
  }

  listar(texto?: string): Observable<any[]> {
    if (texto && texto.trim()) {
      const q = encodeURIComponent(texto.trim());
      return this.http.get<any[]>(this.withTs(`${this.urlApi}?q=${q}`));
    }
    return this.http.get<any[]>(this.withTs(this.urlApi));
  }

  buscar(texto: string): Observable<any[]> {
    return this.http.get<any[]>(
      this.withTs(`${this.urlApi}?q=${encodeURIComponent(texto)}`),
    );
  }

  obtener(id: string): Observable<any> {
    return this.http.get<any>(this.withTs(`${this.urlApi}/${id}`));
  }

  crear(datos: any): Observable<any> {
    return this.http.post<any>(this.urlApi, datos);
  }

  actualizar(id: string, datos: any): Observable<any> {
    return this.http.put<any>(`${this.urlApi}/${id}`, datos);
  }

  cambiarEstado(id: string, activo: boolean): Observable<any> {
    return this.http.patch<any>(`${this.urlApi}/${id}/estado`, { activo });
  }
}
