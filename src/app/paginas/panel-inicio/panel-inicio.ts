import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { ServicioEmpleados } from '../../nucleo/servicios/servicio-empleados';
import {
  ServicioAsistenciasAdmin,
  ResumenDiaResponse,
} from '../../nucleo/servicios/servicio-asistencias-admin';

@Component({
  selector: 'app-panel-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './panel-inicio.html',
  styleUrls: ['./panel-inicio.scss'],
})
export class PanelInicioComponent implements OnInit {
  private readonly dniExcluido = '44823948';

  fecha: string = this.hoyISO();

  cargando = false;
  errorCarga = false;

  totalEmpleados = 0;
  resumen: ResumenDiaResponse | null = null;

  constructor(
    private empleadosSvc: ServicioEmpleados,
    private asistenciasAdmin: ServicioAsistenciasAdmin,
  ) {}

  ngOnInit(): void {
    this.cargar();
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

    this.empleadosSvc
      .listar(1, 10000, undefined)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          const empleadosRaw = resp?.datos || [];
          const empleados = empleadosRaw.filter((e: any) =>
            this.esEmpleadoVisible(e),
          );

          const ids = empleados.map((e: any) => e?.id).filter(Boolean);

          this.totalEmpleados = ids.length;

          if (!this.fecha || !ids.length) {
            this.resumen = null;
            return;
          }

          this.asistenciasAdmin.resumenDia(this.fecha, ids).subscribe({
            next: (r) => {
              this.resumen = this.normalizarResumen(r, ids);
            },
            error: () => {
              this.errorCarga = true;
              this.resumen = null;
            },
          });
        },
        error: () => {
          this.errorCarga = true;
          this.totalEmpleados = 0;
          this.resumen = null;
        },
      });
  }

  horaDe(fechaHora: string | null | undefined): string {
    if (!fechaHora) return '-';

    try {
      const d = new Date(fechaHora);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    } catch {
      return '-';
    }
  }

  private esEmpleadoVisible(empleado: any): boolean {
    const activo =
      empleado?.activo === true ||
      empleado?.activo === 1 ||
      String(empleado?.activo).toLowerCase() === 'true';

    const dni = String(empleado?.numero_documento || '').trim();

    return activo && dni !== this.dniExcluido;
  }

  private normalizarResumen(
    resumen: ResumenDiaResponse,
    idsVisibles: string[],
  ): ResumenDiaResponse {
    const idsPermitidos = new Set(idsVisibles.map((id) => String(id)));

    const ingresos = (resumen?.ingresos || []).filter((row) =>
      idsPermitidos.has(String(row?.usuario_id)),
    );

    const topTardanzas = (resumen?.top_tardanzas || []).filter((row) =>
      idsPermitidos.has(String(row?.usuario_id)),
    );

    const marcaronIngreso = new Set(
      ingresos.map((row) => String(row?.usuario_id)).filter(Boolean),
    ).size;

    return {
      ...resumen,
      total_empleados: idsVisibles.length,
      marcaron_ingreso: marcaronIngreso,
      no_marcaron_ingreso: Math.max(idsVisibles.length - marcaronIngreso, 0),
      tardanzas: topTardanzas.length,
      ingresos,
      top_tardanzas: topTardanzas,
    };
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
    const ingresos = this.resumen?.ingresos || [];
    if (!ingresos.length) return '-';

    const sorted = [...ingresos].sort((a, b) => {
      const fa = new Date(a?.fecha_hora_in || 0).getTime();
      const fb = new Date(b?.fecha_hora_in || 0).getTime();
      return fb - fa;
    });

    return this.horaDe(sorted[0]?.fecha_hora_in);
  }

  maxTardanza(): number {
    const top = this.resumen?.top_tardanzas || [];
    if (!top.length) return 0;
    return Math.max(...top.map((row) => Number(row?.minutos_tarde || 0)));
  }
}
