import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ServicioEmpleados,
  RespuestaListaEmpleados,
} from '../../../nucleo/servicios/servicio-empleados';
import { finalize } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ServicioHorarios } from '../../../nucleo/servicios/servicio-horarios';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-empleados-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: '../../../../../src/app/paginas/empleados/empleados-lista/empleados-lista.html',
  styleUrls: ['../../../../../src/app/paginas/empleados/empleados-lista/empleados-lista.scss'],
})
export class EmpleadosListaComponent implements OnInit {
  empleados: any[] = [];
  cargando = false;
  errorCarga = false;

  terminoBusqueda: string = '';

  tamanoPagina = 20;
  opcionesTamanoPagina = [20, 50, 100];
  paginaActual = 1;
  totalRegistros = 0;

  descargandoId: string | null = null;

  constructor(
    private servicioEmpleados: ServicioEmpleados,
    private servicioHorarios: ServicioHorarios,
  ) {}

  ngOnInit(): void {
    this.cargarEmpleados(1);
  }

  get totalPaginas(): number {
    if (!this.totalRegistros || !this.tamanoPagina) {
      return 1;
    }
    return Math.max(1, Math.ceil(this.totalRegistros / this.tamanoPagina));
  }

  cargarEmpleados(pagina: number): void {
    this.cargando = true;
    this.errorCarga = false;

    const termino = this.terminoBusqueda.trim() || undefined;

    this.servicioEmpleados
      .listar(pagina, this.tamanoPagina, termino)
      .pipe(
        finalize(() => {
          this.cargando = false;
        }),
      )
      .subscribe({
        next: (resp: RespuestaListaEmpleados) => {
          this.empleados = resp.datos || [];
          this.totalRegistros = resp.total ?? this.empleados.length;
          this.paginaActual = resp.pagina ?? pagina;
          this.tamanoPagina = resp.limite ?? this.tamanoPagina;
        },
        error: () => {
          this.errorCarga = true;
          this.empleados = [];
          this.totalRegistros = 0;
          this.paginaActual = 1;
        },
      });
  }

  ejecutarBusqueda(): void {
    this.cargarEmpleados(1);
  }

  cambiarTamanoPagina(nuevoTamano: number): void {
    this.tamanoPagina = nuevoTamano || 20;
    this.cargarEmpleados(1);
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.cargarEmpleados(this.paginaActual - 1);
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.cargarEmpleados(this.paginaActual + 1);
    }
  }

  // ==========================
  // ✅ Cumpleaños: helpers UI
  // ==========================
  private parseISODateOnly(iso?: string | null): Date | null {
    if (!iso) return null;
    const s = String(iso).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private startOfToday(): Date {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }

  diasParaCumple(fechaNacimientoIso?: string | null): number | null {
    const fn = this.parseISODateOnly(fechaNacimientoIso);
    if (!fn) return null;

    const today = this.startOfToday();
    const year = today.getFullYear();

    let next = new Date(year, fn.getMonth(), fn.getDate());
    if (next < today) next = new Date(year + 1, fn.getMonth(), fn.getDate());

    const diffMs = next.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  proximaFechaCumple(fechaNacimientoIso?: string | null): Date | null {
    const fn = this.parseISODateOnly(fechaNacimientoIso);
    if (!fn) return null;

    const today = this.startOfToday();
    const year = today.getFullYear();

    let next = new Date(year, fn.getMonth(), fn.getDate());
    if (next < today) next = new Date(year + 1, fn.getMonth(), fn.getDate());

    return next;
  }

  fmtFecha(d?: Date | null): string {
    if (!d) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  badgeCumple(fechaNacimientoIso?: string | null): { text: string; cls: string } | null {
    const dias = this.diasParaCumple(fechaNacimientoIso);
    const next = this.proximaFechaCumple(fechaNacimientoIso);

    if (dias === null || !next) return null;

    // Solo alertamos fuerte si faltan 0..2 díasbday-badge
    if (dias > 2) {
      return { text: this.fmtFecha(next), cls: 'bday-normal' };
    }

    if (dias === 0) return { text: `HOY (${this.fmtFecha(next)})`, cls: 'bday-hoy' };
    if (dias === 1) return { text: `MAÑANA (${this.fmtFecha(next)})`, cls: 'bday-pronto' };
    return { text: `EN 2 DÍAS (${this.fmtFecha(next)})`, cls: 'bday-pronto' };
  }

  // ==========================
  // PDF horario (tal cual)
  // ==========================
  private async cargarImagenComoDataUrl(url: string): Promise<string | null> {
    try {
      const resp = await fetch(url, { mode: 'cors' });
      const blob = await resp.blob();

      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('No se pudo cargar imagen:', url, e);
      return null;
    }
  }

  descargarHorario(e: any): void {
    if (!e?.id) return;

    this.descargandoId = e.id;

    this.servicioHorarios
      .vigente(e.id)
      .pipe(
        finalize(() => {
          this.descargandoId = null;
        }),
      )
      .subscribe({
        next: (horarios) => {
          try {
            this.generarPdfHorario(e, horarios || []);
          } catch (err) {
            console.error('Error generando PDF de horario', err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo generar el PDF de horario.',
              background: '#111',
              color: '#f5f5f5',
            });
          }
        },
        error: (err) => {
          console.error('Error obteniendo horario vigente', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo obtener el horario vigente del empleado.',
            background: '#111',
            color: '#f5f5f5',
          });
        },
      });
  }

  private async generarPdfHorario(empleado: any, horarios: any[]): Promise<void> {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margen = 15;
    const amarillo = '#f6c326';
    const negro = '#111111';

    let y = 15;

    try {
      const logoUrl = '/logo_negro.png';
      const logoDataUrl = await this.cargarImagenComoDataUrl(logoUrl);

      if (logoDataUrl) {
        const logoAncho = 30;
        const logoAlto = 10;
        doc.addImage(logoDataUrl, 'PNG', margen, y, logoAncho, logoAlto);
      }
    } catch (e) {
      console.warn('No se pudo cargar el logo en PDF horario', e);
    }

    doc.setTextColor(negro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Horario de trabajo', pageWidth - margen, y + 7, {
      align: 'right',
    });

    y += 18;

    doc.setDrawColor(amarillo);
    doc.setLineWidth(0.7);
    doc.line(margen, y, pageWidth - margen, y);
    y += 6;

    const nombreCompleto = `${empleado.nombre || ''} ${empleado.apellido_paterno || ''} ${
      empleado.apellido_materno || ''
    }`.trim();

    doc.setFontSize(11);

    doc.setFont('helvetica', 'bold');
    doc.text('Empleado:', margen, y);
    doc.setFont('helvetica', 'normal');
    doc.text(nombreCompleto || '-', margen + 28, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Documento:', margen, y);
    doc.setFont('helvetica', 'normal');
    doc.text(empleado.numero_documento || '-', margen + 28, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Área:', margen, y);
    doc.setFont('helvetica', 'normal');
    doc.text(empleado.area || '-', margen + 28, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Sede:', margen, y);
    doc.setFont('helvetica', 'normal');
    doc.text(empleado.sede || '-', margen + 28, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(negro);
    doc.text('Horario semanal vigente', margen, y);
    y += 4;

    doc.setDrawColor(amarillo);
    doc.setLineWidth(0.5);
    doc.line(margen, y, pageWidth - margen, y);
    y += 4;

    const dias = [
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ];

    const porDia: Record<number, any> = {};
    for (const h of horarios) {
      if (h.dia_semana) {
        porDia[h.dia_semana] = h;
      }
    }

    const colDiaX = margen;
    const colTurno1X = margen + 35;
    const colTurno2X = margen + 80;
    const colObsX = margen + 125;
    let yFila = y;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Día', colDiaX, yFila);
    doc.text('Turno 1', colTurno1X, yFila);
    doc.text('Turno 2', colTurno2X, yFila);
    doc.text('Obs.', colObsX, yFila);
    yFila += 4;

    doc.setLineWidth(0.3);
    doc.setDrawColor(amarillo);
    doc.line(margen, yFila, pageWidth - margen, yFila);
    yFila += 3;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(negro);
    doc.setFontSize(9);

    for (let i = 1; i <= 7; i++) {
      const h = porDia[i];
      const diaNombre = dias[i - 1];

      let turno1 = '';
      let turno2 = '';
      let obs = '';

      if (!h) {
        obs = 'Sin asignar';
      } else if (h.es_descanso) {
        obs = 'Descanso';
      } else {
        if (h.hora_inicio && h.hora_fin) {
          turno1 = `${h.hora_inicio} - ${h.hora_fin}`;
        }
        if (h.hora_inicio_2 && h.hora_fin_2) {
          turno2 = `${h.hora_inicio_2} - ${h.hora_fin_2}`;
        }
        if (!turno1 && !turno2) {
          obs = 'Sin tramos';
        }
      }

      doc.text(diaNombre, colDiaX, yFila);
      if (turno1) doc.text(turno1, colTurno1X, yFila);
      if (turno2) doc.text(turno2, colTurno2X, yFila);
      if (obs) doc.text(obs, colObsX, yFila);

      yFila += 6;
    }

    const pieY = pageHeight - 10;
    doc.setFontSize(8);
    doc.setTextColor('#555555');
    doc.text(
      `Generado por Registro de Asistencia - ${new Date().toLocaleString()}`,
      margen,
      pieY,
    );

    const nombreArchivo = `horario-empleado-${empleado.apellido_paterno || ''}-${
      empleado.numero_documento || empleado.id
    }.pdf`;
    doc.save(nombreArchivo.replace(/\s+/g, '-'));
  }
}
