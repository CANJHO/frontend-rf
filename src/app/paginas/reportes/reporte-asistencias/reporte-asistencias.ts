import { Component, ChangeDetectorRef, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, Subscription } from 'rxjs';

import Swal from 'sweetalert2';

import { ServicioReportes, PeriodoReporte } from '../../../nucleo/servicios/servicio-reportes';
import { ServicioSedes } from '../../../nucleo/servicios/servicio-sedes';
import { ServicioUsuarios } from '../../../nucleo/servicios/servicio-usuarios';

type UsuarioPick = { id: string; nombreCompleto: string; numero_documento?: string };
type SedePick = { id: string; nombre: string };

@Component({
  selector: 'app-reporte-asistencias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: '../reporte-asistencias/reporte-asistencias.html',
  styleUrls: ['../reporte-asistencias/reporte-asistencias.scss'],
})
export class ReporteAsistenciasComponent implements OnInit, OnDestroy {
  descargando = false;

  modo: 'periodo' | 'rango' = 'periodo';

  period: PeriodoReporte = 'mes';
  ref: string = this.hoy();

  desde: string = this.hoy();
  hasta: string = this.hoy();

  // IDs reales backend
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
    // Sedes activas
    this.subs.add(
      this.sedesSrv.listarActivas().subscribe({
        next: (rows) => {
          this.sedes = (rows || []).map((s: any) => ({ id: s.id, nombre: s.nombre }));
          this.cdr.markForCheck();
        },
        error: () => this.swalError('No se pudo cargar las sedes.'),
      }),
    );

    // Buscador usuario (debounce)
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
  // UI: Usuario
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
  // Params (solo IDs)
  // ==========================
  private buildParams() {
    const base: any = {
      usuarioId: this.usuarioId || undefined,
      sedeId: this.sedeId || undefined,
    };

    if (this.modo === 'rango') {
      return { ...base, desde: this.desde, hasta: this.hasta };
    }
    return { ...base, period: this.period, ref: this.ref };
  }

  // ==========================
  // Descargas RESUMEN
  // ==========================
  descargarExcel() {
    if (this.descargando) return;

    this.zone.run(() => {
      this.descargando = true;
      this.cdr.markForCheck();
    });

    const url = this.reportes.buildResumenExcelUrl(this.buildParams());
    this.descargarPorUrl(url, 'reporte_asistencias_resumen.xlsx');
  }

  descargarPdf() {
    if (this.descargando) return;

    this.zone.run(() => {
      this.descargando = true;
      this.cdr.markForCheck();
    });

    const url = this.reportes.buildResumenPdfUrl(this.buildParams());
    this.descargarPorUrl(url, 'reporte_asistencias_resumen.pdf');
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
