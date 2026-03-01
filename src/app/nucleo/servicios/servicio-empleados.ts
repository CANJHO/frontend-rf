import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
export interface RespuestaListaEmpleados {
  datos: any[];
  total: number;
  pagina: number;
  limite: number;
}

// ✅ NUEVO: DTO cumpleaños próximos
export interface CumpleanosProximoRow {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  numero_documento: string | null;
  fecha_nacimiento: string; // YYYY-MM-DD
  proximo_cumple: string;   // YYYY-MM-DD
  dias_faltan: number;      // 0..N
}

@Injectable({
  providedIn: 'root',
})
export class ServicioEmpleados {
  private readonly urlBase = `${API_BASE_URL}/empleados`;

  constructor(private http: HttpClient) {}

  listar(
    pagina: number,
    limite: number,
    buscar?: string,
  ): Observable<RespuestaListaEmpleados> {
    let params = new HttpParams()
      .set('pagina', pagina)
      .set('limite', limite);

    if (buscar && buscar.trim()) {
      params = params.set('buscar', buscar.trim());
    }

    return this.http.get<RespuestaListaEmpleados>(this.urlBase, { params });
  }

  obtenerFicha(id: string): Observable<any> {
    return this.http.get<any>(`${this.urlBase}/${id}/ficha`);
  }

  subirFoto(id: string, archivo: File): Observable<any> {
    const formData = new FormData();
    formData.append('foto', archivo);

    return this.http.post<any>(`${this.urlBase}/${id}/foto`, formData);
  }

  descargarCarnet(id: string): Observable<Blob> {
    return this.http.get(`${this.urlBase}/${id}/carnet-pdf`, {
      responseType: 'blob',
    });
  }

  // ✅ NUEVO: cumpleaños próximos para modal/alertas
  cumpleanosProximos(dias: number = 5): Observable<CumpleanosProximoRow[]> {
    const params = new HttpParams().set('dias', String(dias));
    return this.http.get<CumpleanosProximoRow[]>(
      `${this.urlBase}/cumpleanos-proximos`,
      { params },
    );
  }
}
