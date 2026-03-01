import { Component, ChangeDetectorRef, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, Subscription } from 'rxjs';

import Swal from 'sweetalert2';

import { ServicioReportes } from '../../../nucleo/servicios/servicio-reportes';
import { ServicioSedes } from '../../../nucleo/servicios/servicio-sedes';
import { ServicioUsuarios } from '../../../nucleo/servicios/servicio-usuarios';

type UsuarioPick = { id: string; nombreCompleto: string; numero_documento?: string };
type SedePick = { id: string; nombre: string };

@Component({
  selector: 'app-reporte-asistencias-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: '../reporte-asistencias-detalle/reporte-asistencias-detalle.html',
  styleUrls: ['../reporte-asistencias-detalle/reporte-asistencias-detalle.scss'],
})
export class ReporteAsistenciasDetalleComponent implements OnInit, OnDestroy {
  descargando = false;

  // detalle SIEMPRE es rango
  desde: string = this.hoy();
  hasta: string = this.hoy();

  // filtros
  usuarioId: string = '';
  sedeId: string = '';

  // UI
  sedes: SedePick[] = [];
  usuarioQuery: string = '';
  usuariosSugeridos: UsuarioPick[] = [];
  usuarioSeleccionado: UsuarioPick | null = null;

  private buscarUsuario$ = new Subject<string>();
  private subs = new Subscription();

  constructor(
    private reportes: ServicioReportes,
    private sedesSrv: ServicioSedes,
    private usuariosSrv: ServicioUsuarios,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // sedes
    this.subs.add(
      this.sedesSrv.listarActivas().subscribe({
        next: (rows) => {
          this.sedes = (rows || []).map((s: any) => ({ id: s.id, nombre: s.nombre }));
          this.cdr.markForCheck();
        },
        error: () => this.swalError('No se pudo cargar las sedes.'),
      }),
    );

    // buscador usuario
    this.subs.add(
      this.buscarUsuario$
        .pipe(debounceTime(250), distinctUntilChanged())
        .subscribe((q) => {
          const texto = (q || '').trim();
          if (texto.length < 2) {
            this.usuariosSugeridos = [];
            this.cdr.markForCheck();
            return;
          }

          this.usuariosSrv.listar(texto).subscribe({
            next: (rows) => {
              this.usuariosSugeridos = (rows || []).map((u: any) => ({
                id: u.id,
                nombreCompleto: `${u.nombre} ${u.apellido_paterno || ''} ${u.apellido_materno || ''}`.trim(),
                numero_documento: u.numero_documento,
              }));
              this.cdr.markForCheck();
            },
            error: () => this.swalError('No se pudo buscar usuarios.'),
          });
        }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private hoy() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  // ==========================
  // UI: Usuario (buscador)
  // ==========================
  onUsuarioInput() {
    this.usuarioSeleccionado = null;
    this.usuarioId = '';
    this.buscarUsuario$.next(this.usuarioQuery);
  }

  seleccionarUsuario(u: UsuarioPick) {
    this.usuarioSeleccionado = u;
    this.usuarioId = u.id;
    this.usuarioQuery = `${u.nombreCompleto}${u.numero_documento ? ' - ' + u.numero_documento : ''}`;
    this.usuariosSugeridos = [];
  }

  limpiarUsuario() {
    this.usuarioSeleccionado = null;
    this.usuarioId = '';
    this.usuarioQuery = '';
    this.usuariosSugeridos = [];
  }

  // ==========================
  // UI: Sede
  // ==========================
  onSedeChange(sedeId: string) {
    this.sedeId = sedeId || '';
  }

  // ==========================
  // Descargar detalle (Excel)
  // ==========================
  descargarDetalleExcel() {
    if (this.descargando) return;

    if (!this.desde || !this.hasta) {
      return this.swalError('Debe seleccionar un rango de fechas (desde y hasta).');
    }

    // Política performance: NO permitir global sin filtro
    if (!this.usuarioId && !this.sedeId) {
      const d1 = new Date(this.desde + 'T00:00:00');
      const d2 = new Date(this.hasta + 'T00:00:00');
      const diffDays = Math.floor((+d2 - +d1) / (1000 * 60 * 60 * 24)) + 1;

      if (!isFinite(diffDays) || diffDays <= 0) {
        return this.swalError('Rango inválido.');
      }

      if (diffDays > 31) {
        return this.swalError('Sin filtros (todas las sedes) el rango máximo permitido es 31 días.');
      }
    }


    this.zone.run(() => {
      this.descargando = true;
      this.cdr.markForCheck();
    });

    const url = this.reportes.buildDetalleExcelUrl({
      desde: this.desde,
      hasta: this.hasta,
      usuarioId: this.usuarioId || undefined,
      sedeId: this.sedeId || undefined,
    });

    this.descargarPorUrl(url, 'reporte_asistencias_detalle.xlsx');
  }

  // ==========================
  // ✅ NUEVO: Descargar detalle (PDF)
  // ==========================
  descargarDetallePdf() {
    if (this.descargando) return;

    if (!this.desde || !this.hasta) {
      return this.swalError('Debe seleccionar un rango de fechas (desde y hasta).');
    }

    if (!this.usuarioId && !this.sedeId) {
      const d1 = new Date(this.desde + 'T00:00:00');
      const d2 = new Date(this.hasta + 'T00:00:00');
      const diffDays = Math.floor((+d2 - +d1) / (1000 * 60 * 60 * 24)) + 1;

      if (!isFinite(diffDays) || diffDays <= 0) {
        return this.swalError('Rango inválido.');
      }

      if (diffDays > 31) {
        return this.swalError('Sin filtros (todas las sedes) el rango máximo permitido es 31 días.');
      }
    }


    this.zone.run(() => {
      this.descargando = true;
      this.cdr.markForCheck();
    });

    const url = this.reportes.buildDetallePdfUrl({
      desde: this.desde,
      hasta: this.hasta,
      usuarioId: this.usuarioId || undefined,
      sedeId: this.sedeId || undefined,
    });

    this.descargarPorUrl(url, 'reporte_asistencias_detalle.pdf');
  }

  private async descargarPorUrl(url: string, filename: string) {
    try {
      const token = localStorage.getItem('token') || '';

      const r = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) {
        const contentType = r.headers.get('content-type') || '';
        let bodyText = '';
        try {
          if (contentType.includes('application/json')) {
            const j: any = await r.json();
            bodyText = j?.message
              ? (Array.isArray(j.message) ? j.message.join(' | ') : String(j.message))
              : JSON.stringify(j);
          } else {
            bodyText = await r.text();
          }
        } catch {
          bodyText = '';
        }
        throw new Error(`HTTP ${r.status} ${r.statusText}${bodyText ? `\n${bodyText}` : ''}`);
      }

      const blob = await r.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(link.href);

      this.swalOk('Reporte generado correctamente.');
    } catch (e: any) {
      console.error('Descarga falló. URL:', url, 'Error:', e);
      this.swalError(`No se pudo descargar.\n\n${e?.message || 'Verifica filtros y permisos.'}`);
    } finally {
      this.zone.run(() => {
        this.descargando = false;
        this.cdr.markForCheck();
      });
    }
  }

  private swalOk(msg: string) {
    Swal.fire({
      icon: 'success',
      title: 'Listo',
      text: msg,
      confirmButtonText: 'Aceptar',
    });
  }

  private swalError(msg: string) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: msg,
      confirmButtonText: 'Aceptar',
    });
  }
}
