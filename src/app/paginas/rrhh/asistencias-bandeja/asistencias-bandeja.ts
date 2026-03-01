import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import {
  ServicioEmpleados,
  RespuestaListaEmpleados,
} from '../../../nucleo/servicios/servicio-empleados';

import {
  ServicioAsistenciasAdmin,
  PendienteRow,
} from '../../../nucleo/servicios/servicio-asistencias-admin';

@Component({
  selector: 'app-asistencias-bandeja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asistencias-bandeja.html',
  styleUrls: ['./asistencias-bandeja.scss'],
})
export class AsistenciasBandejaComponent implements OnInit {
  empleados: any[] = [];
  cargando = false;
  errorCarga = false;

  terminoBusqueda = '';

  tamanoPagina = 20;
  opcionesTamanoPagina = [20, 50, 100];
  paginaActual = 1;
  totalRegistros = 0;

  // YYYY-MM-DD
  fecha: string = this.hoyISO();

  // mapa usuario_id -> fecha_pendiente (YYYY-MM-DD)
  pendientesMap: Record<string, string> = {};

  constructor(
    private servicioEmpleados: ServicioEmpleados,
    private asistenciasAdmin: ServicioAsistenciasAdmin,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.cargarEmpleados(1);
  }

  private hoyISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toISODateOnly(value: string): string {
    const v = (value || '').trim();
    if (!v) return '';
    // si llega como 2025-12-11T05:00:00.000Z -> 2025-12-11
    return v.includes('T') ? v.split('T')[0] : v;
  }

  get totalPaginas(): number {
    if (!this.totalRegistros || !this.tamanoPagina) return 1;
    return Math.max(1, Math.ceil(this.totalRegistros / this.tamanoPagina));
  }

  cargarEmpleados(pagina: number): void {
    this.cargando = true;
    this.errorCarga = false;
    this.pendientesMap = {};

    const termino = this.terminoBusqueda.trim() || undefined;

    this.servicioEmpleados
      .listar(pagina, this.tamanoPagina, termino)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp: RespuestaListaEmpleados) => {
          this.empleados = resp.datos || [];
          this.totalRegistros = resp.total ?? this.empleados.length;
          this.paginaActual = resp.pagina ?? pagina;
          this.tamanoPagina = resp.limite ?? this.tamanoPagina;

          const ids = (this.empleados || []).map(e => e?.id).filter(Boolean);
          if (ids.length > 0) this.cargarPendientes(ids);
        },
        error: () => {
          this.errorCarga = true;
          this.empleados = [];
          this.totalRegistros = 0;
          this.paginaActual = 1;
        },
      });
  }

  private cargarPendientes(ids: string[]): void {
    this.asistenciasAdmin.pendientes(ids).subscribe({
      next: (rows: PendienteRow[]) => {
        const map: Record<string, string> = {};
        for (const r of (rows || [])) {
          if (r?.usuario_id && r?.fecha_pendiente) {
            map[r.usuario_id] = this.toISODateOnly(r.fecha_pendiente);
          }
        }
        this.pendientesMap = map;
      },
      error: () => {
        this.pendientesMap = {};
      }
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
    if (this.paginaActual > 1) this.cargarEmpleados(this.paginaActual - 1);
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas)
      this.cargarEmpleados(this.paginaActual + 1);
  }

  verAsistenciasDelDia(empleado: any): void {
    if (!empleado?.id) return;
    const fecha = (this.fecha || '').trim();
    if (!fecha) return;
    this.router.navigate(['/panel/empleados/asistencias', empleado.id, fecha]);
  }

  irAPendiente(empleado: any): void {
    if (!empleado?.id) return;
    const f = this.pendientesMap[empleado.id];
    if (!f) return;
    this.router.navigate(['/panel/empleados/asistencias', empleado.id, f]);
  }

  tienePendiente(empleado: any): boolean {
    return !!(empleado?.id && this.pendientesMap[empleado.id]);
  }

  fechaPendiente(empleado: any): string {
    return (empleado?.id && this.pendientesMap[empleado.id]) ? this.pendientesMap[empleado.id] : '';
  }
}
