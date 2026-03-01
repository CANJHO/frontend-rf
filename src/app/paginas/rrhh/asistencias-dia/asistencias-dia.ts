import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  ServicioAsistenciasAdmin,
  AsistenciaRow,
  EmpleadoCabecera,
} from '../../../nucleo/servicios/servicio-asistencias-admin';

type EventoUI = 'JORNADA_IN' | 'REFRIGERIO_OUT' | 'REFRIGERIO_IN' | 'JORNADA_OUT';

@Component({
  selector: 'app-asistencias-dia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asistencias-dia.html',
  styleUrls: ['./asistencias-dia.scss'],
})
export class AsistenciasDiaComponent implements OnInit {
  usuarioId = '';
  fecha = '';

  empleado: EmpleadoCabecera | null = null;

  timeline: AsistenciaRow[] = [];
  cargando = false;
  errorCarga = false;

  // Acciones
  procesandoId: string | null = null;

  // Crear manual
  creando = false;
  formHora = '08:00';
  formEvento: EventoUI = 'JORNADA_IN';
  formMotivo = '';

  eventos: { value: EventoUI; label: string }[] = [
    { value: 'JORNADA_IN', label: 'Ingreso (Jornada IN)' },
    { value: 'REFRIGERIO_OUT', label: 'Salida (Refrigerio OUT)' },
    { value: 'REFRIGERIO_IN', label: 'Ingreso (Refrigerio IN)' },
    { value: 'JORNADA_OUT', label: 'Salida (Jornada OUT)' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private asistenciasAdmin: ServicioAsistenciasAdmin,
  ) {}

  ngOnInit(): void {
    this.usuarioId = this.route.snapshot.paramMap.get('usuarioId') || '';
    this.fecha = this.route.snapshot.paramMap.get('fecha') || '';

    if (!this.usuarioId || !this.fecha) {
      this.router.navigate(['/panel/empleados/asistencias']);
      return;
    }

    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = false;

    this.asistenciasAdmin
      .timeline(this.usuarioId, this.fecha)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          this.empleado = resp?.empleado ?? null;

          const rows = resp?.timeline ?? [];
          this.timeline = rows.slice().sort((a, b) =>
            (a.fecha_hora || '').localeCompare(b.fecha_hora || ''),
          );
        },
        error: () => {
          this.errorCarga = true;
          this.timeline = [];
          this.empleado = null;
        },
      });
  }

  volver(): void {
    this.router.navigate(['/panel/empleados/asistencias']);
  }

  // ====== Labels UI ======
  labelEstado(e: string | null | undefined): string {
    if (e === 'aprobado') return 'Aprobado';
    if (e === 'pendiente') return 'Pendiente';
    if (e === 'rechazado') return 'Rechazado';
    return e || '-';
  }

  claseEstado(e: string | null | undefined): string {
    if (e === 'aprobado') return 'badge--ok';
    if (e === 'pendiente') return 'badge--warn';
    if (e === 'rechazado') return 'badge--bad';
    return '';
  }

  labelTipo(t: string | null | undefined): string {
    if (t === 'IN') return 'Entrada';
    if (t === 'OUT') return 'Salida';
    return t || '-';
  }

  // ====== Acciones por fila ======
  aprobar(a: AsistenciaRow): void {
    if (!a?.id) return;

    // Motivo opcional según backend, pero lo pedimos para auditoría
    const motivo = window.prompt('Motivo (opcional) para aprobar:', '') ?? '';
    this.procesandoId = a.id;

    this.asistenciasAdmin
      .aprobar(a.id, motivo)
      .pipe(finalize(() => (this.procesandoId = null)))
      .subscribe({
        next: () => this.cargar(),
        error: () => window.alert('No se pudo aprobar. Revisa consola / backend.'),
      });
  }

  rechazar(a: AsistenciaRow): void {
    if (!a?.id) return;

    const motivo = window.prompt('Motivo OBLIGATORIO para rechazar:', '') ?? '';
    if (!motivo.trim()) {
      window.alert('Motivo es obligatorio para rechazar.');
      return;
    }

    this.procesandoId = a.id;

    this.asistenciasAdmin
      .rechazar(a.id, motivo.trim())
      .pipe(finalize(() => (this.procesandoId = null)))
      .subscribe({
        next: () => this.cargar(),
        error: () => window.alert('No se pudo rechazar. Revisa consola / backend.'),
      });
  }

  anular(a: AsistenciaRow): void {
    if (!a?.id) return;

    const motivo = window.prompt('Motivo OBLIGATORIO para anular:', '') ?? '';
    if (!motivo.trim()) {
      window.alert('Motivo es obligatorio para anular.');
      return;
    }

    const ok = window.confirm('¿Confirmas ANULAR este marcaje? (No se borra, queda rechazado)');
    if (!ok) return;

    this.procesandoId = a.id;

    this.asistenciasAdmin
      .anular(a.id, motivo.trim())
      .pipe(finalize(() => (this.procesandoId = null)))
      .subscribe({
        next: () => this.cargar(),
        error: () => window.alert('No se pudo anular. Revisa consola / backend.'),
      });
  }

  // ====== Crear manual ======
  crearManual(): void {
    const hora = (this.formHora || '').trim();
    const motivo = (this.formMotivo || '').trim();

    if (!hora) {
      window.alert('La hora es obligatoria.');
      return;
    }
    if (!motivo) {
      window.alert('El motivo es obligatorio.');
      return;
    }

    this.creando = true;

    this.asistenciasAdmin
      .crearManual({
        usuarioId: this.usuarioId,
        fecha: this.fecha,
        hora,
        evento: this.formEvento as any,
        motivo,
      })
      .pipe(finalize(() => (this.creando = false)))
      .subscribe({
        next: () => {
          this.formMotivo = '';
          this.cargar();
        },
        error: (e) => {
          const msg =
            (e?.error && (e.error.message || e.error.error)) ||
            'No se pudo crear el marcaje manual.';
          window.alert(msg);
        },
      });
  }

  // Helpers UI
  deshabilitarAprobar(a: AsistenciaRow): boolean {
    return this.procesandoId === a.id || a.estado_validacion === 'aprobado';
  }
  deshabilitarRechazar(a: AsistenciaRow): boolean {
    return this.procesandoId === a.id || a.estado_validacion === 'rechazado';
  }
  deshabilitarAnular(a: AsistenciaRow): boolean {
    return this.procesandoId === a.id;
  }
}
