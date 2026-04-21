import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { ServicioEmpleados } from '../../nucleo/servicios/servicio-empleados';
import {
  AsistenciaAdminListadoRow,
  PendienteRow,
  ServicioAsistenciasAdmin,
} from '../../nucleo/servicios/servicio-asistencias-admin';

type EstadoActividad = 'Completo' | 'En refrigerio' | 'Pendiente salida' | 'Sin registros';

interface KpiResumen {
  total_empleados: number;
  marcaron_ingreso: number;
  no_marcaron_ingreso: number;
  tardanzas: number;
  pendientes: number;
}

interface ActividadFila {
  usuario_id: string;
  nombre_completo: string;
  numero_documento: string | null;
  area: string;
  sede: string;
  foto_perfil_url: string | null;
  jornada_in: string | null;
  refrigerio_out: string | null;
  refrigerio_in: string | null;
  jornada_out: string | null;
  minutos_tarde_ingreso: number;
  minutos_tarde_refrigerio: number;
  estado: EstadoActividad;
}

interface TardanzaDestacada {
  nombre: string;
  detalle: string;
  minutos: number;
}

@Component({
  selector: 'app-panel-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './panel-inicio.html',
  styleUrls: ['./panel-inicio.scss'],
})
export class PanelInicioComponent implements OnInit, AfterViewInit {
  private readonly dniExcluido = '44823948';

  fecha: string = this.hoyISO();
  sedeSeleccionada = '';

  cargando = false;
  errorCarga = false;

  resumen: KpiResumen | null = null;
  actividad: ActividadFila[] = [];
  sedesDisponibles: string[] = [];

  private empleadosTodos: any[] = [];
  private empleadosPorId: Record<string, any> = {};
  private pendientesMap: Record<string, string> = {};
  private asistenciasPorUsuario: Record<string, AsistenciaAdminListadoRow[]> = {};
  @ViewChild('actividadScroller') actividadScroller?: ElementRef<HTMLDivElement>;

  constructor(
    private empleadosSvc: ServicioEmpleados,
    private asistenciasAdmin: ServicioAsistenciasAdmin,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngAfterViewInit(): void {
    this.ajustarScrollActividad();
  }

  private hoyISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = false;
    this.resumen = null;
    this.actividad = [];

    this.empleadosSvc
      .listar(1, 10000, undefined)
      .subscribe({
        next: (resp) => {
          const empleados = (resp?.datos || []).filter((e: any) => this.esEmpleadoVisible(e));
          const ids = empleados.map((e: any) => String(e?.id)).filter(Boolean);

          this.empleadosTodos = empleados;
          this.empleadosPorId = empleados.reduce(
            (acc: Record<string, any>, empleado: any) => {
              if (empleado?.id) {
                acc[String(empleado.id)] = empleado;
              }
              return acc;
            },
            {},
          );

          this.sedesDisponibles = Array.from(
            new Set(
              empleados
                .map((e: any) => String(e?.sede || '').trim())
                .filter(Boolean),
            ),
          ).sort((a, b) => a.localeCompare(b, 'es'));

          if (this.sedeSeleccionada && !this.sedesDisponibles.includes(this.sedeSeleccionada)) {
            this.sedeSeleccionada = '';
          }

          if (!this.fecha || ids.length === 0) {
            this.resumen = {
              total_empleados: 0,
              marcaron_ingreso: 0,
              no_marcaron_ingreso: 0,
              tardanzas: 0,
              pendientes: 0,
            };
            this.cargando = false;
            return;
          }

          forkJoin({
            asistencias: this.asistenciasAdmin.listar({ desde: this.fecha, hasta: this.fecha }),
            pendientes: this.asistenciasAdmin.pendientes(ids),
          })
            .pipe(finalize(() => (this.cargando = false)))
            .subscribe({
              next: ({ asistencias, pendientes }) => {
                this.asistenciasPorUsuario = this.agruparAsistencias(asistencias || []);
                this.pendientesMap = this.mapearPendientes(pendientes || []);
                this.reconstruirVista();
                setTimeout(() => this.ajustarScrollActividad());
              },
              error: () => {
                this.errorCarga = true;
                this.resumen = null;
                this.actividad = [];
              },
            });
        },
        error: () => {
          this.cargando = false;
          this.errorCarga = true;
          this.empleadosTodos = [];
          this.empleadosPorId = {};
          this.sedesDisponibles = [];
          this.resumen = null;
        },
      });
  }

  onFiltrosActividadChange(): void {
    this.reconstruirVista();
    setTimeout(() => this.ajustarScrollActividad());
  }

  private esEmpleadoVisible(empleado: any): boolean {
    const activo =
      empleado?.activo === true ||
      empleado?.activo === 1 ||
      String(empleado?.activo).toLowerCase() === 'true';

    const dni = String(empleado?.numero_documento || '').trim();

    return activo && dni !== this.dniExcluido;
  }

  private agruparAsistencias(rows: AsistenciaAdminListadoRow[]): Record<string, AsistenciaAdminListadoRow[]> {
    const grouped: Record<string, AsistenciaAdminListadoRow[]> = {};

    for (const row of rows || []) {
      if (!row?.usuario_id || row?.estado_validacion === 'rechazado') continue;

      const id = String(row.usuario_id);
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push(row);
    }

    for (const id of Object.keys(grouped)) {
      grouped[id] = grouped[id].sort((a, b) => {
        return new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime();
      });
    }

    return grouped;
  }

  private mapearPendientes(rows: PendienteRow[]): Record<string, string> {
    return (rows || []).reduce((acc: Record<string, string>, row: PendienteRow) => {
      if (row?.usuario_id && row?.fecha_pendiente) {
        acc[String(row.usuario_id)] = String(row.fecha_pendiente);
      }
      return acc;
    }, {});
  }

  private reconstruirVista(): void {
    const empleadosFiltrados = this.empleadosTodos.filter((empleado) => {
      if (!this.sedeSeleccionada) return true;
      return String(empleado?.sede || '') === this.sedeSeleccionada;
    });

    const actividad = empleadosFiltrados.map((empleado) => this.construirFilaActividad(empleado));

    this.actividad = actividad;
    this.resumen = {
      total_empleados: actividad.length,
      marcaron_ingreso: actividad.filter((row) => !!row.jornada_in).length,
      no_marcaron_ingreso: actividad.filter((row) => !row.jornada_in).length,
      tardanzas: actividad.filter(
        (row) =>
          Number(row.minutos_tarde_ingreso || 0) > 0 ||
          Number(row.minutos_tarde_refrigerio || 0) > 0,
      ).length,
      pendientes: empleadosFiltrados.filter((empleado) => !!this.pendientesMap[String(empleado.id)]).length,
    };
  }

  private construirFilaActividad(empleado: any): ActividadFila {
    const usuarioId = String(empleado?.id || '');
    const asistencias = this.asistenciasPorUsuario[usuarioId] || [];

    const jornadaInRow = asistencias.find((row) => row.evento === 'JORNADA_IN');
    const refrigerioOutRow = asistencias.find((row) => row.evento === 'REFRIGERIO_OUT');
    const refrigerioInRow = asistencias.find((row) => row.evento === 'REFRIGERIO_IN');
    const jornadaOutRows = asistencias.filter((row) => row.evento === 'JORNADA_OUT');
    const jornadaOutRow = jornadaOutRows.length ? jornadaOutRows[jornadaOutRows.length - 1] : null;

    let estado: EstadoActividad = 'Sin registros';
    if (jornadaInRow && jornadaOutRow) {
      estado = 'Completo';
    } else if (refrigerioOutRow && !refrigerioInRow && !jornadaOutRow) {
      estado = 'En refrigerio';
    } else if (jornadaInRow) {
      estado = 'Pendiente salida';
    }

    return {
      usuario_id: usuarioId,
      nombre_completo: this.nombreCompleto(empleado),
      numero_documento: empleado?.numero_documento || null,
      area: empleado?.area || empleado?.rol || 'Sin area',
      sede: empleado?.sede || 'Sin sede',
      foto_perfil_url: empleado?.foto_perfil_url || null,
      jornada_in: this.horaDe(jornadaInRow?.fecha_hora),
      refrigerio_out: this.horaDe(refrigerioOutRow?.fecha_hora),
      refrigerio_in: this.horaDe(refrigerioInRow?.fecha_hora),
      jornada_out: this.horaDe(jornadaOutRow?.fecha_hora),
      minutos_tarde_ingreso: Number(jornadaInRow?.minutos_tarde || 0),
      minutos_tarde_refrigerio: Number(refrigerioInRow?.minutos_tarde || 0),
      estado,
    };
  }

  private nombreCompleto(empleado: any): string {
    return [
      empleado?.nombre,
      empleado?.apellido_paterno,
      empleado?.apellido_materno,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  horaDe(fechaHora: string | null | undefined): string | null {
    if (!fechaHora) return null;

    try {
      const d = new Date(fechaHora);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch {
      return null;
    }
  }

  formatoHoraVisible(hora: string | null): string {
    return hora || '-';
  }

  tardanzaLabel(mins: number | null | undefined): string {
    const v = Number(mins || 0);
    return v > 0 ? `${v} min` : '0';
  }

  asistenciaPct(): number {
    if (!this.resumen?.total_empleados) return 0;
    return Math.round((this.resumen.marcaron_ingreso / this.resumen.total_empleados) * 100);
  }

  ultimaHoraIngreso(): string {
    const horas = this.actividad
      .map((row) => row.jornada_in)
      .filter((value): value is string => !!value)
      .sort((a, b) => a.localeCompare(b));

    return horas.length ? horas[horas.length - 1] : '-';
  }

  maxTardanza(): number {
    if (!this.actividad.length) return 0;
    return Math.max(
      ...this.actividad.map((row) =>
        Math.max(
          Number(row.minutos_tarde_ingreso || 0),
          Number(row.minutos_tarde_refrigerio || 0),
        ),
      ),
    );
  }

  tardanzasDestacadas(): TardanzaDestacada[] {
    return this.actividad
      .flatMap((row) => {
        const items: TardanzaDestacada[] = [];

        if (Number(row.minutos_tarde_ingreso || 0) > 0) {
          items.push({
            nombre: row.nombre_completo,
            detalle: `Ingreso ${row.jornada_in || '-'}`,
            minutos: Number(row.minutos_tarde_ingreso || 0),
          });
        }

        if (Number(row.minutos_tarde_refrigerio || 0) > 0) {
          items.push({
            nombre: row.nombre_completo,
            detalle: `Retorno ${row.refrigerio_in || '-'}`,
            minutos: Number(row.minutos_tarde_refrigerio || 0),
          });
        }

        return items;
      })
      .sort((a, b) => b.minutos - a.minutos)
      .slice(0, 4);
  }

  porcentajeTexto(valor: number, total: number): string {
    if (!total) return '0% del total';
    return `${((valor / total) * 100).toFixed(1)}% del total`;
  }

  fotoEmpleado(usuarioId: string): string | null {
    return this.empleadosPorId[String(usuarioId)]?.foto_perfil_url || null;
  }

  detalleEmpleado(usuarioId: string): string {
    const empleado = this.empleadosPorId[String(usuarioId)];
    return empleado?.area || empleado?.rol || 'Empleado';
  }

  inicialesEmpleado(nombreCompleto: string): string {
    const partes = String(nombreCompleto || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!partes.length) return 'EM';
    return partes.map((p) => p[0]?.toUpperCase() || '').join('');
  }

  fechaActividadLabel(): string {
    if (!this.fecha) return 'Selecciona fecha';
    const fecha = new Date(`${this.fecha}T00:00:00`);
    const hoy = new Date();

    const esHoy =
      fecha.getFullYear() === hoy.getFullYear() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getDate() === hoy.getDate();

    const texto = fecha.toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return esHoy ? `Hoy, ${texto}` : texto;
  }

  estadoClase(estado: EstadoActividad): string {
    switch (estado) {
      case 'Completo':
        return 'estado-badge--ok';
      case 'En refrigerio':
        return 'estado-badge--warn';
      case 'Pendiente salida':
        return 'estado-badge--alert';
      default:
        return 'estado-badge--muted';
    }
  }

  eventoTarde(tipo: 'ingreso' | 'refrigerio', row: ActividadFila): boolean {
    if (tipo === 'ingreso') {
      return Number(row.minutos_tarde_ingreso || 0) > 0;
    }

    return Number(row.minutos_tarde_refrigerio || 0) > 0;
  }

  scrollActividad(direction: 'left' | 'right'): void {
    const el = this.actividadScroller?.nativeElement;
    if (!el) return;

    const delta = Math.max(260, Math.round(el.clientWidth * 0.55));
    el.scrollBy({
      left: direction === 'right' ? delta : -delta,
      behavior: 'smooth',
    });
  }

  private ajustarScrollActividad(): void {
    const el = this.actividadScroller?.nativeElement;
    if (!el) return;
    el.scrollLeft = 0;
  }
}
