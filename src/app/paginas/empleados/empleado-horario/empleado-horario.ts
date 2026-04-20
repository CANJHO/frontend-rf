import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { ServicioHorarios } from '../../../nucleo/servicios/servicio-horarios';
import { ServicioEmpleados } from '../../../nucleo/servicios/servicio-empleados';

interface DiaHorarioUI {
  dia: number; // 1 = Lunes ... 7 = Domingo
  nombreDia: string;
  es_descanso: boolean;
  hora_inicio: string | null;
  hora_fin: string | null;
  hora_inicio_2: string | null;
  hora_fin_2: string | null;
  tolerancia_min: number;
}

type TipoExcepcion = 'HORARIO_ESPECIAL' | 'DESCANSO_ESPECIAL' | 'LABORABLE_EN_DESCANSO';

@Component({
  selector: 'app-empleado-horario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empleado-horario.html',
  styleUrls: ['./empleado-horario.scss'],
})
export class EmpleadoHorarioComponent implements OnInit {
  readonly tiposExcepcion: Array<{ value: TipoExcepcion; label: string }> = [
    { value: 'HORARIO_ESPECIAL', label: 'Horario especial' },
    { value: 'DESCANSO_ESPECIAL', label: 'Descanso especial' },
    { value: 'LABORABLE_EN_DESCANSO', label: 'Laborable en día de descanso' },
  ];

  empleadoId!: string;
  empleadoResumen: any | null = null;

  cargando = false;
  guardando = false;
  errorCarga = false;

  // Historial
  mostrandoHistorial = false;
  cargandoHistorial = false;
  historial: any[] = [];

  // ✅ FECHAS (LOCAL) - NO UTC
  fechaReferencia: string = this.hoyLocalISO(); // YYYY-MM-DD
  exFecha: string = this.hoyLocalISO();         // YYYY-MM-DD

  // Semana en formato “calendario”
  semana: DiaHorarioUI[] = [];

  readonly diasSemana = [
    { dia: 1, nombre: 'Lunes' },
    { dia: 2, nombre: 'Martes' },
    { dia: 3, nombre: 'Miércoles' },
    { dia: 4, nombre: 'Jueves' },
    { dia: 5, nombre: 'Viernes' },
    { dia: 6, nombre: 'Sábado' },
    { dia: 7, nombre: 'Domingo' },
  ];

  // ==========================
  // EXCEPCIONES (UI)
  // ==========================
  exTipo: TipoExcepcion = 'HORARIO_ESPECIAL';
  exEsLaborable: boolean = true;
  exHoraInicio: string | null = null;
  exHoraFin: string | null = null;
  exObservacion: string = '';

  exCargandoDia = false;
  exGuardando = false;
  exActual: any | null = null;

  constructor(
    private ruta: ActivatedRoute,
    private router: Router,
    private servicioHorarios: ServicioHorarios,
    private servicioEmpleados: ServicioEmpleados,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = this.ruta.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/panel/empleados']);
      return;
    }

    this.empleadoId = id;

    this.inicializarSemana();
    this.cargarResumenEmpleado();

    // ✅ Cargar con fecha LOCAL
    this.cargarHorarioVigente();
    this.cargarExcepcionDelDia();
  }

  // ==========================
  // ✅ FECHA LOCAL (FIX REAL)
  // ==========================
  /**
   * Devuelve YYYY-MM-DD usando hora local del navegador (no UTC).
   * Evita el bug de "tengo que ver mañana/pasado".
   */
  private hoyLocalISO(): string {
    const d = new Date();
    const tzOffsetMin = d.getTimezoneOffset(); // min a restar para llegar a "local ISO"
    const local = new Date(d.getTime() - tzOffsetMin * 60_000);
    return local.toISOString().slice(0, 10);
  }

  // ==========================
  // HELPERS (TIME)
  // ==========================
  /** Convierte "08:00:00" -> "08:00" para que el <input type="time"> lo muestre */
  private toHHmm(v: any): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;

    if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      return s.slice(0, 5);
    }
    return null;
  }

  /** Asegura que lo que mandas al backend esté limpio (HH:mm o null). */
  private cleanTimeForApi(v: string | null): string | null {
    const t = this.toHHmm(v);
    return t ? t : null;
  }

  get exTipoLabel(): string {
    return this.tiposExcepcion.find((item) => item.value === this.exTipo)?.label || this.exTipo;
  }

  private normalizarTipoExcepcion(tipo: any): TipoExcepcion {
    const valor = String(tipo || '').trim().toUpperCase();
    return (
      this.tiposExcepcion.find((item) => item.value === valor)?.value ||
      'HORARIO_ESPECIAL'
    );
  }

  private inicializarSemana() {
    this.semana = this.diasSemana.map((d) => ({
      dia: d.dia,
      nombreDia: d.nombre,
      es_descanso: true,
      hora_inicio: null,
      hora_fin: null,
      hora_inicio_2: null,
      hora_fin_2: null,
      tolerancia_min: 15,
    }));
  }

  private cargarResumenEmpleado() {
    this.servicioEmpleados.obtenerFicha(this.empleadoId).subscribe({
      next: (emp) => (this.empleadoResumen = emp),
      error: (err) =>
        console.warn('No se pudo cargar resumen de empleado en módulo horario', err),
    });
  }

  // Se ejecuta cuando cambias la fecha (input date)
  onCambioFechaReferencia() {
    this.cargarHorarioVigente();
  }

  cargarHorarioVigente() {
    this.cargando = true;
    this.errorCarga = false;

    this.servicioHorarios
      .vigente(this.empleadoId, this.fechaReferencia)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (rows) => {
          this.mapearSemanaDesdeBackend(rows || []);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error cargando horario vigente', err);
          this.errorCarga = true;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el horario vigente.',
            background: '#111',
            color: '#f5f5f5',
          });
        },
      });
  }

  private mapearSemanaDesdeBackend(rows: any[]) {
    this.inicializarSemana();

    const porDia: Record<number, any> = {};
    for (const r of rows) {
      if (r.dia_semana) porDia[r.dia_semana] = r;
    }

    this.semana = this.semana.map((item) => {
      const r = porDia[item.dia];
      if (!r) return item;

      return {
        ...item,
        es_descanso: !!r.es_descanso,
        hora_inicio: this.toHHmm(r.hora_inicio),
        hora_fin: this.toHHmm(r.hora_fin),
        hora_inicio_2: this.toHHmm(r.hora_inicio_2),
        hora_fin_2: this.toHHmm(r.hora_fin_2),
        tolerancia_min: r.tolerancia_min ?? 15,
      };
    });
  }

  // Alternar descanso / laborable para un día
  toggleDescanso(dia: DiaHorarioUI) {
    dia.es_descanso = !dia.es_descanso;
    if (dia.es_descanso) {
      dia.hora_inicio = null;
      dia.hora_fin = null;
      dia.hora_inicio_2 = null;
      dia.hora_fin_2 = null;
    }
  }

  // ==========================
  // VALIDACIÓN SEMANA
  // ==========================
  private validarSemana(): string[] {
    const errores: string[] = [];

    for (const d of this.semana) {
      if (d.es_descanso) continue;

      const t1Inicio = d.hora_inicio;
      const t1Fin = d.hora_fin;
      const t2Inicio = d.hora_inicio_2;
      const t2Fin = d.hora_fin_2;

      if ((t1Inicio && !t1Fin) || (!t1Inicio && t1Fin)) {
        errores.push(`Completa la hora de inicio y fin del Turno 1 en ${d.nombreDia}.`);
      }

      if ((t2Inicio && !t2Fin) || (!t2Inicio && t2Fin)) {
        errores.push(`Completa la hora de inicio y fin del Turno 2 en ${d.nombreDia}.`);
      }

      if (t1Inicio && t1Fin && t1Inicio >= t1Fin) {
        errores.push(`En ${d.nombreDia}, la hora de inicio del Turno 1 debe ser menor que la hora de fin.`);
      }

      if (t2Inicio && t2Fin && t2Inicio >= t2Fin) {
        errores.push(`En ${d.nombreDia}, la hora de inicio del Turno 2 debe ser menor que la hora de fin.`);
      }

      if (!t1Inicio && !t1Fin && !t2Inicio && !t2Fin) {
        errores.push(`Configura al menos un tramo (Turno 1 o Turno 2) en ${d.nombreDia} o márcalo como descanso.`);
      }

      if (d.tolerancia_min < 0 || d.tolerancia_min > 60) {
        errores.push(`La tolerancia en ${d.nombreDia} debe estar entre 0 y 60 minutos.`);
      }
    }

    return errores;
  }

  // Guardar la semana en el backend como nueva vigencia
  guardarSemana() {
    if (this.guardando) return;

    const errores = this.validarSemana();
    if (errores.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Revisa el horario',
        html: `<ul style="text-align:left; margin:0; padding-left:1.2rem; font-size:0.9rem;">
          ${errores.map((e) => `<li>${e}</li>`).join('')}
        </ul>`,
        background: '#111',
        color: '#f5f5f5',
      });
      return;
    }

    const payload = {
      fecha_inicio: this.fechaReferencia,
      items: this.semana.map((d) => ({
        dia: d.dia,
        hora_inicio: d.es_descanso ? null : this.cleanTimeForApi(d.hora_inicio),
        hora_fin: d.es_descanso ? null : this.cleanTimeForApi(d.hora_fin),
        hora_inicio_2: d.es_descanso ? null : this.cleanTimeForApi(d.hora_inicio_2),
        hora_fin_2: d.es_descanso ? null : this.cleanTimeForApi(d.hora_fin_2),
        es_descanso: d.es_descanso,
        tolerancia_min: d.tolerancia_min,
      })),
    };

    this.guardando = true;

    this.servicioHorarios
      .setSemana(this.empleadoId, payload)
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Horario guardado',
            text: 'La nueva semana de horario se guardó correctamente.',
            background: '#111',
            color: '#f5f5f5',
          });

          this.cargarHorarioVigente();
        },
        error: (err) => {
          console.error('Error guardando horario de semana', err);
          Swal.fire({
            icon: 'error',
            title: 'No se pudo guardar',
            text: 'Ocurrió un error al guardar el horario. Intenta nuevamente.',
            background: '#111',
            color: '#f5f5f5',
          });
        },
      });
  }

  // ==========================
  // HISTORIAL
  // ==========================
  toggleHistorial() {
    if (this.mostrandoHistorial) {
      this.mostrandoHistorial = false;
      return;
    }

    this.mostrandoHistorial = true;

    if (this.historial.length > 0) return;

    this.cargandoHistorial = true;

    this.servicioHorarios
      .historial(this.empleadoId)
      .pipe(finalize(() => (this.cargandoHistorial = false)))
      .subscribe({
        next: (rows) => (this.historial = rows || []),
        error: (err) => {
          console.error('Error cargando historial de horarios', err);
          this.mostrandoHistorial = false;
          Swal.fire({
            icon: 'error',
            title: 'No se pudo cargar el historial',
            text: 'Ocurrió un error al obtener el historial de horarios.',
            background: '#111',
            color: '#f5f5f5',
          });
        },
      });
  }

  // ==========================
  // EXCEPCIONES
  // ==========================
  onCambioFechaExcepcion() {
    this.cargarExcepcionDelDia();
  }

  private cargarExcepcionDelDia() {
    if (!this.empleadoId) return;

    this.exCargandoDia = true;

    this.servicioHorarios
      .dia(this.empleadoId, this.exFecha)
      .pipe(finalize(() => (this.exCargandoDia = false)))
      .subscribe({
        next: (resp) => {
          const ex = resp?.excepcion || null;
          this.exActual = ex ? { ...ex } : null;

          if (this.exActual) {
            this.exTipo = this.normalizarTipoExcepcion(this.exActual.tipo);
            this.exEsLaborable = !!this.exActual.es_laborable;
            this.exHoraInicio = this.toHHmm(this.exActual.hora_inicio);
            this.exHoraFin = this.toHHmm(this.exActual.hora_fin);
            this.exObservacion = this.exActual.observacion || '';
          } else {
            this.exTipo = 'HORARIO_ESPECIAL';
            this.exEsLaborable = true;
            this.exHoraInicio = null;
            this.exHoraFin = null;
            this.exObservacion = '';
          }

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error obteniendo horario del día', err);
          this.exActual = null;
        },
      });
  }

  guardarExcepcion() {
    if (this.exGuardando) return;

    if (this.exActual) {
      Swal.fire({
        icon: 'warning',
        title: 'Ya existe excepción',
        text: 'Para esta fecha ya hay una excepción registrada. Elimínala primero si deseas volver a crearla.',
        background: '#111',
        color: '#f5f5f5',
      });
      return;
    }

    if (!this.exFecha) {
      Swal.fire({
        icon: 'warning',
        title: 'Fecha requerida',
        text: 'Selecciona la fecha de la excepción.',
        background: '#111',
        color: '#f5f5f5',
      });
      return;
    }

    if (this.exEsLaborable) {
      if ((this.exHoraInicio && !this.exHoraFin) || (!this.exHoraInicio && this.exHoraFin)) {
        Swal.fire({
          icon: 'warning',
          title: 'Horario incompleto',
          text: 'Completa la hora de inicio y fin de la excepción o deja ambas en blanco.',
          background: '#111',
          color: '#f5f5f5',
        });
        return;
      }

      if (this.exHoraInicio && this.exHoraFin && this.exHoraInicio >= this.exHoraFin) {
        Swal.fire({
          icon: 'warning',
          title: 'Horario inválido',
          text: 'La hora de inicio debe ser menor que la hora de fin.',
          background: '#111',
          color: '#f5f5f5',
        });
        return;
      }
    }

    const payload = {
      fecha: this.exFecha,
      tipo: this.exTipo,
      es_laborable: this.exEsLaborable,
      hora_inicio: this.exEsLaborable ? this.cleanTimeForApi(this.exHoraInicio) : null,
      hora_fin: this.exEsLaborable ? this.cleanTimeForApi(this.exHoraFin) : null,
      observacion: this.exObservacion?.trim() || null,
    };

    this.exGuardando = true;

    this.servicioHorarios
      .addExcepcion(this.empleadoId, payload)
      .pipe(finalize(() => (this.exGuardando = false)))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Excepción guardada',
            text: 'La excepción de horario se registró correctamente.',
            background: '#111',
            color: '#f5f5f5',
          });

          this.exActual = null;
          this.cargarExcepcionDelDia();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error guardando excepción', err);
          Swal.fire({
            icon: 'error',
            title: 'No se pudo guardar',
            text: err?.error?.message || 'Ocurrió un error al guardar la excepción.',
            background: '#111',
            color: '#f5f5f5',
          });
        },
      });
  }

  eliminarExcepcionActual() {
    if (!this.exActual) return;

    Swal.fire({
      icon: 'warning',
      title: 'Eliminar excepción',
      text: '¿Seguro que deseas eliminar esta excepción?',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#111',
      color: '#f5f5f5',
    }).then((res) => {
      if (!res.isConfirmed) return;

      this.exGuardando = true;

      this.servicioHorarios
        .eliminarExcepcion(this.exActual.id)
        .pipe(finalize(() => (this.exGuardando = false)))
        .subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Excepción eliminada',
              text: 'La excepción fue eliminada correctamente.',
              background: '#111',
              color: '#f5f5f5',
            });
            this.exActual = null;
            this.cargarExcepcionDelDia();
          },
          error: (err) => {
            console.error('Error eliminando excepción', err);
            Swal.fire({
              icon: 'error',
              title: 'No se pudo eliminar',
              text: 'Ocurrió un error al eliminar la excepción.',
              background: '#111',
              color: '#f5f5f5',
            });
          },
        });
    });
  }

  // ==========================
  // NAVEGACIÓN
  // ==========================
  volverAEmpleado() {
    this.router.navigate(['/panel/empleados', this.empleadoId]);
  }
}
