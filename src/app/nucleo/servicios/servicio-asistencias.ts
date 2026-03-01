import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type TipoMarcaje = 'IN' | 'OUT';
export type MetodoMarcaje =
  | 'scanner_barras'
  | 'qr_fijo'
  | 'qr_dinamico'
  | 'manual_supervisor';

export type EventoAsistencia =
  | 'JORNADA_IN'
  | 'REFRIGERIO_OUT'
  | 'REFRIGERIO_IN'
  | 'JORNADA_OUT';

export interface RespuestaMarcaje {
  ok: boolean;
  estado: 'aprobado' | 'pendiente';

  // ✅ nuevos (auto)
  evento?: EventoAsistencia;
  tipo?: 'IN' | 'OUT';

  geo: {
    ok: boolean;
    modo: 'punto' | 'sede' | 'sin_gps';
    distancia: number | null;
    radio: number | null;
    puntoId?: string | null;
  };
  horario: any | null;
  excepcion: any | null;
  minutos_tarde: number | null;

  empleado?: {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string;
    foto_url?: string | null;
    sede?: string | null;
    area?: string | null;
  };
}

export interface KioskoMarcajeRespuesta extends RespuestaMarcaje {}

@Injectable({
  providedIn: 'root',
})
export class ServicioAsistencias {
  private readonly urlBase = 'http://localhost:3000/asistencias';

  constructor(private http: HttpClient) {}

  marcar(
    usuarioId: string,
    tipo: TipoMarcaje,
    metodo: MetodoMarcaje = 'scanner_barras',
  ): Observable<RespuestaMarcaje> {
    return this.http.post<RespuestaMarcaje>(`${this.urlBase}/marcar`, {
      usuarioId,
      tipo,
      metodo,
    });
  }

  marcarKiosko(
    identificador: string,
    tipo: 'IN' | 'OUT',
  ): Observable<KioskoMarcajeRespuesta> {
    return this.http.post<KioskoMarcajeRespuesta>(`${this.urlBase}/marcar`, {
      usuarioId: identificador,
      tipo,
      metodo: 'scanner_barras',
    });
  }

  // ✅ NUEVO: kiosko automático
  marcarKioskoAuto(identificador: string): Observable<KioskoMarcajeRespuesta> {
    return this.http.post<KioskoMarcajeRespuesta>(`${this.urlBase}/marcar-auto`, {
      identificador,
    });
  }
}
