import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EventoAsistencia, MetodoMarcaje } from './servicio-asistencias';
import { API_BASE_URL } from '../../config/api.config';

export type EstadoValidacion = 'aprobado' | 'pendiente' | 'rechazado';

export interface AsistenciaRow {
  id: string;
  usuario_id: string;
  fecha_hora: string;
  evento: EventoAsistencia;
  tipo: 'IN' | 'OUT';
  metodo: MetodoMarcaje;
  estado_validacion: EstadoValidacion;
  minutos_tarde?: number | null;
}

export interface EmpleadoCabecera {
  id: string;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  numero_documento: string | null;
  nombre_completo: string;
}

export interface TimelineResponse {
  empleado: EmpleadoCabecera;
  timeline: AsistenciaRow[];
}

export interface CrearManualDTO {
  usuarioId: string;
  fecha: string; // YYYY-MM-DD
  hora: string;  // HH:mm o HH:mm:ss
  evento: EventoAsistencia;
  motivo: string;
  evidencia?: any;
}

export interface PendienteRow {
  usuario_id: string;
  fecha_pendiente: string; // YYYY-MM-DD
}

export interface ResumenDiaResponse {
  fecha: string;
  total_empleados: number;
  marcaron_ingreso: number;
  no_marcaron_ingreso: number;
  tardanzas: number;
  pendientes: number;
  ingresos: Array<{
    usuario_id: string;
    nombre_completo: string;
    numero_documento: string | null;
    fecha_hora_in: string;
    minutos_tarde: number;
  }>;
  top_tardanzas: Array<{
    usuario_id: string;
    nombre_completo: string;
    numero_documento: string | null;
    fecha_hora_in: string;
    minutos_tarde: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class ServicioAsistenciasAdmin {
  private readonly urlBaseAdmin = `${API_BASE_URL}/asistencias-admin`;

  constructor(private http: HttpClient) {}

  timeline(usuarioId: string, fecha: string): Observable<TimelineResponse> {
    return this.http.get<TimelineResponse>(
      `${this.urlBaseAdmin}/timeline`,
      { params: { usuarioId, fecha } },
    );
  }

  crearManual(payload: CrearManualDTO): Observable<{ ok: boolean; id: string }> {
    return this.http.post<{ ok: boolean; id: string }>(
      `${this.urlBaseAdmin}/manual`,
      payload,
    );
  }

  anular(id: string, motivo: string, evidencia?: any): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(
      `${this.urlBaseAdmin}/${id}/anular`,
      { motivo, evidencia: evidencia ?? null },
    );
  }

  aprobar(id: string, motivo?: string): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(
      `${this.urlBaseAdmin}/${id}/aprobar`,
      { motivo: motivo?.trim() || null },
    );
  }

  rechazar(id: string, motivo: string): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(
      `${this.urlBaseAdmin}/${id}/rechazar`,
      { motivo },
    );
  }

  pendientes(usuarioIds: string[]): Observable<PendienteRow[]> {
    const csv = (usuarioIds || []).filter(Boolean).join(',');
    const params = new HttpParams().set('usuarioIds', csv);
    return this.http.get<PendienteRow[]>(
      `${this.urlBaseAdmin}/pendientes`,
      { params },
    );
  }

  // ✅ NUEVO: resumen del día (Inicio)
  resumenDia(fecha: string, usuarioIds: string[]): Observable<ResumenDiaResponse> {
    const csv = (usuarioIds || []).filter(Boolean).join(',');
    const params = new HttpParams()
      .set('fecha', fecha)
      .set('usuarioIds', csv);

    return this.http.get<ResumenDiaResponse>(
      `${this.urlBaseAdmin}/resumen-dia`,
      { params },
    );
  }
}
