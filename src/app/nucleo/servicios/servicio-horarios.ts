import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ServicioHorarios {
  // Ajusta la URL base según tu .env / proxy si es distinto
  private readonly urlBase = 'http://localhost:3000/horarios';

  constructor(private http: HttpClient) {}

  /**
   * Horario del día (para una fecha específica, incluye excepción si existe).
   * Backend: GET /horarios/dia/:usuarioId?fecha=YYYY-MM-DD
   */
  dia(usuarioId: string, fecha?: string): Observable<any> {
    let params = new HttpParams();
    if (fecha) {
      params = params.set('fecha', fecha);
    }

    return this.http.get<any>(`${this.urlBase}/dia/${usuarioId}`, {
      params,
    });
  }

  /**
   * Horarios vigentes de un usuario en una fecha (opcional).
   * Backend: GET /horarios/vigente/:usuarioId?fecha=YYYY-MM-DD
   */
  vigente(usuarioId: string, fecha?: string): Observable<any[]> {
    let params = new HttpParams();
    if (fecha) {
      params = params.set('fecha', fecha);
    }

    return this.http.get<any[]>(`${this.urlBase}/vigente/${usuarioId}`, {
      params,
    });
  }

  /**
   * Historial completo de horarios del usuario.
   * Backend: GET /horarios/historial/:usuarioId
   */
  historial(usuarioId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.urlBase}/historial/${usuarioId}`);
  }

  /**
   * Define una nueva semana (7 días) de horario, cerrando vigencias anteriores.
   * Backend: POST /horarios/semana/:usuarioId
   */
  setSemana(usuarioId: string, payload: any): Observable<any> {
    return this.http.post<any>(`${this.urlBase}/semana/${usuarioId}`, payload);
  }

  /**
   * Cierra el horario vigente de un usuario a una fecha dada.
   * Backend: PUT /horarios/cerrar/:usuarioId
   *
   * body: { fecha_fin: 'YYYY-MM-DD' }
   */
  cerrarVigencia(usuarioId: string, fecha_fin: string): Observable<any> {
    return this.http.put<any>(`${this.urlBase}/cerrar/${usuarioId}`, {
      fecha_fin,
    });
  }

  /**
   * Agregar excepción de horario para una fecha puntual.
   * Backend: POST /horarios/excepcion/:usuarioId
   *
   * body:
   * {
   *   fecha: 'YYYY-MM-DD',
   *   tipo: string,
   *   es_laborable: boolean,
   *   hora_inicio?: string | null,
   *   hora_fin?: string | null,
   *   observacion?: string | null
   * }
   */
  addExcepcion(usuarioId: string, payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.urlBase}/excepcion/${usuarioId}`,
      payload,
    );
  }

  /**
   * Eliminar excepción por id.
   * Backend: DELETE /horarios/excepcion/:id
   */
  eliminarExcepcion(id: string): Observable<any> {
    return this.http.delete<any>(`${this.urlBase}/excepcion/${id}`);
  }
}
