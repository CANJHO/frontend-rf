// kiosko-marcaje.ts
import { Component, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ServicioAsistencias,
  RespuestaMarcaje,
} from '../../nucleo/servicios/servicio-asistencias';
import { finalize, Subscription } from 'rxjs';

@Component({
  selector: 'app-kiosko-marcaje',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kiosko-marcaje.html',
  styleUrl: './kiosko-marcaje.scss',
})
export class KioskoMarcajeComponent implements OnDestroy {
  /** 📅 Fecha de hoy (para el encabezado) */
  hoy = new Date();

  /** 🕒 Texto del reloj grande */
  reloj = '';

  /** 📌 Código que escribe/escanea el empleado */
  inputCodigo = '';

  /** ⏳ Estado de carga */
  procesando = false;

  /** 🧨 Texto de error general (cuando la petición falla) */
  errorTexto: string | null = null;

  /** ✅ Resultado del último marcaje */
  mensaje:
    | {
        ok: boolean;
        texto: string;
        estado?: 'aprobado' | 'pendiente';
        empleado?: {
          id: string;
          nombre: string;
          apellido_paterno: string;
          apellido_materno: string;
          sede?: string | null;
          area?: string | null;
          foto_url?: string | null;
        } | null;
        tipo?: 'IN' | 'OUT';
        evento?: string; // ✅ NUEVO (JORNADA_IN / REFRIGERIO_OUT / REFRIGERIO_IN / JORNADA_OUT)
        minutos_tarde?: number | null;
      }
    | null = null;

  private timerId: any;
  private subMarcaje?: Subscription;

  constructor(
    private asistenciasSrv: ServicioAsistencias,
    private zone: NgZone,
  ) {
    this.actualizarHora();
    this.timerId = setInterval(() => {
      this.actualizarHora();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) clearInterval(this.timerId);
    if (this.subMarcaje) this.subMarcaje.unsubscribe();
  }

  /** 🕒 Actualiza el reloj cada segundo */
  private actualizarHora() {
    const ahora = new Date();
    this.reloj = ahora.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  /** 🔄 Limpia el campo y el mensaje */
  limpiar() {
    this.inputCodigo = '';
    this.mensaje = null;
    this.errorTexto = null;
  }

  // ✅ Helper para mensajes por evento (kiosko automático)
  private textoPorEvento(evento: string | undefined, minutos_tarde: number | null | undefined): string {
    switch (evento) {
      case 'JORNADA_IN': {
        const min = minutos_tarde ?? 0;
        return `ENTRADA registrada correctamente. Tardanza de ${min} minuto(s).`;
      }
      case 'REFRIGERIO_OUT':
        return 'SALIDA A REFRIGERIO registrada correctamente.';
      case 'REFRIGERIO_IN':
        return 'RETORNO DE REFRIGERIO registrado correctamente.';
      case 'JORNADA_OUT':
        return 'SALIDA registrada correctamente.';
      default:
        return 'Marcaje registrado correctamente.';
    }
  }

  /**
   * ✅ NUEVO: Registro AUTOMÁTICO (sin botones IN/OUT)
   * - El backend decide: JORNADA_IN / REFRIGERIO_OUT / REFRIGERIO_IN / JORNADA_OUT
   * - No rompe tu flujo actual: tú decides si lo llamas desde el HTML
   */
  onRegistrarAuto() {
    const codigo = this.inputCodigo.trim();
    if (!codigo || this.procesando) return;

    this.procesando = true;
    this.mensaje = null;
    this.errorTexto = null;

    if (this.subMarcaje) this.subMarcaje.unsubscribe();

    this.subMarcaje = this.asistenciasSrv
      .marcarKioskoAuto(codigo) // ✅ requiere que exista en servicio-asistencias.ts
      .pipe(
        finalize(() => {
          this.procesando = false;
        }),
      )
      .subscribe({
        next: (resp: any) => {
          const emp = resp?.empleado ?? null;
          const evento = resp?.evento as string | undefined;
          const tipo = resp?.tipo as 'IN' | 'OUT' | undefined;

          const texto = this.textoPorEvento(evento, resp?.minutos_tarde);

          this.mensaje = {
            ok: resp?.ok ?? true,
            texto,
            estado: resp?.estado,
            empleado: emp,
            tipo,
            evento,
            minutos_tarde: resp?.minutos_tarde ?? null,
          };

          this.inputCodigo = '';
          this.errorTexto = null;
        },
        error: (err) => {
          console.error('Error al registrar en kiosko (AUTO):', err);
          this.mensaje = null;
          this.errorTexto =
            err?.error?.message ||
            'Ocurrió un error al registrar la asistencia. Intenta nuevamente o contacta a Recursos Humanos.';
        },
      });
  }

  /** 🟢🔴 Registrar ENTRADA / SALIDA (conectado al HTML) */
  onRegistrar(tipo: 'IN' | 'OUT') {
    const codigo = this.inputCodigo.trim();
    if (!codigo || this.procesando) return;

    this.procesando = true;
    this.mensaje = null;
    this.errorTexto = null;

    // Cancelar petición anterior si sigue viva
    if (this.subMarcaje) this.subMarcaje.unsubscribe();

    this.subMarcaje = this.asistenciasSrv
      .marcarKiosko(codigo, tipo)
      .pipe(
        finalize(() => {
          // Siempre se ejecuta, falle o no la petición
          this.procesando = false;
        }),
      )
      .subscribe({
        next: (resp: RespuestaMarcaje) => {
          const emp = (resp as any).empleado ?? null;

          let texto = '';
          if (!resp.ok) {
            texto = 'Marcaje pendiente de validación.';
          } else if (tipo === 'IN') {
            const min = resp.minutos_tarde ?? 0;
            texto = `ENTRADA registrada correctamente. Tardanza de ${min} minuto(s).`;
          } else {
            texto = 'SALIDA registrada correctamente.';
          }

          this.mensaje = {
            ok: resp.ok,
            texto,
            estado: resp.estado, // <- para (pendiente de validación)
            empleado: emp,
            tipo,
            minutos_tarde: resp.minutos_tarde ?? null,
          };

          this.inputCodigo = '';
          this.errorTexto = null;
        },
        error: (err) => {
          console.error('Error al registrar en kiosko:', err);
          this.mensaje = null;
          this.errorTexto =
            err?.error?.message ||
            'Ocurrió un error al registrar la asistencia. Intenta nuevamente o contacta a Recursos Humanos.';
        },
      });
  }

  /** 👤 Nombre completo mostrado en la tarjeta del empleado */
  getNombreEmpleado(): string {
    const emp = this.mensaje?.empleado;
    if (!emp) return '';
    return `${emp.nombre} ${emp.apellido_paterno} ${emp.apellido_materno}`.trim();
  }
}
