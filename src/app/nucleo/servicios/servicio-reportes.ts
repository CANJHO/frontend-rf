import { Injectable } from '@angular/core';

export type PeriodoReporte =
  | 'semana'
  | 'quincena'
  | 'mes'
  | 'bimestre'
  | 'trimestre'
  | 'semestre'
  | 'anual';

@Injectable({ providedIn: 'root' })
export class ServicioReportes {
  private base = 'http://localhost:3000/reportes';

  buildResumenUrl(params: {
    period?: PeriodoReporte;
    ref?: string;      // YYYY-MM-DD
    desde?: string;    // YYYY-MM-DD
    hasta?: string;    // YYYY-MM-DD
    usuarioId?: string;
    sedeId?: string;
  }) {
    const qs = new URLSearchParams();
    if (params.period) qs.set('period', params.period);
    if (params.ref) qs.set('ref', params.ref);
    if (params.desde) qs.set('desde', params.desde);
    if (params.hasta) qs.set('hasta', params.hasta);
    if (params.usuarioId) qs.set('usuarioId', params.usuarioId);
    if (params.sedeId) qs.set('sedeId', params.sedeId);
    return `${this.base}/resumen?${qs.toString()}`;
  }

  buildResumenExcelUrl(params: any) {
    return this.buildResumenUrl(params).replace('/resumen?', '/resumen-excel?');
  }

  buildResumenPdfUrl(params: any) {
    return this.buildResumenUrl(params).replace('/resumen?', '/resumen-pdf?');
  }

  // ✅ Detalle Excel (requiere rango desde/hasta)
  buildDetalleExcelUrl(params: {
    desde: string;
    hasta: string;
    usuarioId?: string;
    sedeId?: string;
  }) {
    const qs = new URLSearchParams();
    qs.set('desde', params.desde);
    qs.set('hasta', params.hasta);
    if (params.usuarioId) qs.set('usuarioId', params.usuarioId);
    if (params.sedeId) qs.set('sedeId', params.sedeId);
    return `${this.base}/detalle-excel?${qs.toString()}`;
  }

  // ✅ NUEVO: Usuarios PDF (solo columnas de imagen)
  buildUsuariosPdfUrl() {
    return `${this.base}/usuarios-pdf`;
  }
  buildDetallePdfUrl(params: {
  desde: string;
  hasta: string;
  usuarioId?: string;
  sedeId?: string;
}) {
  const q = new URLSearchParams();
  q.set('desde', params.desde);
  q.set('hasta', params.hasta);
  if (params.usuarioId) q.set('usuarioId', params.usuarioId);
  if (params.sedeId) q.set('sedeId', params.sedeId);

  return `${this.base}/detalle-pdf?${q.toString()}`;
}

}
