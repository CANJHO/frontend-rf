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

    // 🔥 Traemos TODOS los empleados (si tu org crece, luego lo optimizamos)
    this.empleadosSvc
      .listar(1, 10000, undefined)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          const empleados = resp?.datos || [];
          const ids = empleados.map((e: any) => e?.id).filter(Boolean);

          this.totalEmpleados = ids.length;

          if (!this.fecha || !ids.length) {
            this.resumen = null;
            return;
          }

          this.asistenciasAdmin.resumenDia(this.fecha, ids).subscribe({
            next: (r) => (this.resumen = r),
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

  // Helpers UI
  horaDe(fechaHora: string | null | undefined): string {
    if (!fechaHora) return '-';
    // viene como timestamp; mostramos HH:mm:ss
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

  tardanzaLabel(mins: number | null | undefined): string {
    const v = Number(mins || 0);
    return v > 0 ? `${v} min` : '0';
  }
}
