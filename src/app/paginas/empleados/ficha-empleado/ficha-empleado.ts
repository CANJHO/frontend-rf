import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { RouterModule } from '@angular/router';
import { ServicioEmpleados } from '../../../nucleo/servicios/servicio-empleados';
import { ServicioHorarios } from '../../../nucleo/servicios/servicio-horarios';


interface HorarioDiaUI {
  dia: number;
  nombre: string;
  turno1: string;
  turno2: string;
  etiqueta: string; // "Descanso" | "Sin asignar" | ""
}

@Component({
  selector: 'app-ficha-empleado',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ficha-empleado.html',
  styleUrls: ['./ficha-empleado.scss'],
})
export class FichaEmpleadoComponent implements OnInit {
  cargando = false;
  errorCarga = false;
  empleado: any | null = null;

  // FOTO
  previewFoto: string | null = null;
  archivoSeleccionado: File | null = null;
  subiendoFoto = false;

  // ESTADOS
  imprimiendoCarnet = false;
  imprimiendoFicha = false;      // Ficha A4
  imprimiendoFotocheck = false;  // Fotocheck

  // HORARIOS (UI)
  cargandoHorarios = false;
  errorHorarios = false;
  horariosUI: HorarioDiaUI[] = [];

  constructor(
    private ruta: ActivatedRoute,
    private router: Router,
    private servicioEmpleados: ServicioEmpleados,
    private servicioHorarios: ServicioHorarios,
    
  ) {}

  ngOnInit(): void {
    const id = this.ruta.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/panel/empleados']);
      return;
    }

    this.cargando = true;
    this.errorCarga = false;
   

    this.servicioEmpleados
      .obtenerFicha(id)
      .pipe(
        finalize(() => {
          this.cargando = false;
          
        }),
      )
      .subscribe({
        next: (data) => {
          this.empleado = data;
          // 👇 apenas tenemos al empleado, cargamos sus horarios vigentes
          if (this.empleado?.id) {
            this.cargarHorariosVigentes(this.empleado.id);
          }
        },
        error: (err) => {
          console.error('Error cargando ficha empleado', err);
          this.errorCarga = true;
        },
      });
  }

  volverAListado(): void {
    this.router.navigate(['/panel/empleados']);
  }

  // ================= FOTO =================

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length) {
      return;
    }

    const archivo = input.files[0];
    this.archivoSeleccionado = archivo;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewFoto = reader.result as string;
      
    };
    reader.readAsDataURL(archivo);
  }

  cancelarPreview(): void {
    this.previewFoto = null;
    this.archivoSeleccionado = null;
  }

  subirFoto(): void {
    if (!this.empleado?.id || !this.archivoSeleccionado) {
      return;
    }

    this.subiendoFoto = true;
    

    this.servicioEmpleados
      .subirFoto(this.empleado.id, this.archivoSeleccionado)
      .pipe(
        finalize(() => {
          this.subiendoFoto = false;
          
        }),
      )
      .subscribe({
        next: (resp) => {
          const baseUrl =
            resp?.foto_perfil_url || this.empleado.foto_perfil_url;
          const nuevaUrl = `${baseUrl}${
            baseUrl.includes('?') ? '&' : '?'
          }t=${Date.now()}`;

          this.empleado.foto_perfil_url = nuevaUrl;
          this.previewFoto = null;
          this.archivoSeleccionado = null;

          Swal.fire({
            icon: 'success',
            title: 'Foto actualizada',
            text: 'La foto del empleado se actualizó correctamente.',
            timer: 1800,
            showConfirmButton: false,
            background: '#111',
            color: '#f5f5f5',
          });
        },
        error: (err) => {
          console.error('Error subiendo foto', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar la foto. Intente nuevamente.',
            background: '#111',
            color: '#f5f5f5',
          });
        },
      });
  }

  // ================= HELPER IMG → DATAURL (USADO EN FOTO / FOTOCHECK / FICHA) =================

  private async cargarImagenComoDataUrl(url?: string): Promise<string | null> {
    if (!url) return null;

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

  // ================= HORARIOS VIGENTES (PANTALLA) =================

  private cargarHorariosVigentes(usuarioId: string): void {
    this.cargandoHorarios = true;
    this.errorHorarios = false;
    this.horariosUI = [];
    

    this.servicioHorarios
      .vigente(usuarioId)
      .pipe(
        finalize(() => {
          this.cargandoHorarios = false;
          
        }),
      )
      .subscribe({
        next: (rows) => {
          // rows = lista de usuario_horarios vigentes
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
          for (const h of rows || []) {
            if (h.dia_semana) {
              porDia[h.dia_semana] = h;
            }
          }

          const ui: HorarioDiaUI[] = [];
          for (let i = 1; i <= 7; i++) {
            const h = porDia[i];
            let turno1 = '';
            let turno2 = '';
            let etiqueta = '';

            if (!h) {
              etiqueta = 'Sin asignar';
            } else if (h.es_descanso) {
              etiqueta = 'Descanso';
            } else {
              if (h.hora_inicio && h.hora_fin) {
                turno1 = `${h.hora_inicio} - ${h.hora_fin}`;
              }
              if (h.hora_inicio_2 && h.hora_fin_2) {
                turno2 = `${h.hora_inicio_2} - ${h.hora_fin_2}`;
              }
            }

            ui.push({
              dia: i,
              nombre: dias[i - 1],
              turno1,
              turno2,
              etiqueta,
            });
          }

          this.horariosUI = ui;
        },
        error: (err) => {
          console.error('Error cargando horarios vigentes', err);
          this.errorHorarios = true;
        },
      });
  }

  // ================= FOTOCHECK (PDF JS – TAL COMO LO TIENES) =================

  async descargarFotocheck() {
    if (!this.empleado) return;

    this.imprimiendoFotocheck = true;
    

    try {
      const emp = this.empleado;

      // Tamaño tipo fotocheck
      const width = 87;   // mm
      const height = 135; // mm

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [width, height],
      });

      const amarillo = '#f6c326';
      const negro = '#111111';
      const blanco = '#ffffff';

      // =======================
      // FONDO + DIAGONAL
      // =======================

      // Fondo base amarillo
      doc.setFillColor(amarillo);
      doc.rect(0, 0, width, height, 'F');

      // Queremos que la diagonal pase por la zona del círculo
      const centroX = width / 2;
      const centroY = 50;
      const radioFoto = 29;

      // Donde la diagonal "toca" el círculo (aprox. borde inferior del anillo)
      const yCorte = centroY + radioFoto - 4;

      // Parte negra inferior con la diagonal
      doc.setFillColor(negro);
      (doc as any).setDrawColor(negro);
      (doc as any).setLineWidth(0);
      (doc as any).lines(
        [
          [width, -yCorte],
          [0, height],
          [-width, 0],
          [0, -height],
        ],
        0,
        yCorte,
        [1, 1],
        'F',
      );

      // Por seguridad, rellenamos toda la parte por debajo del corte en negro
      doc.rect(0, yCorte, width, height - yCorte, 'F');

      // =======================
      // LOGO SUPERIOR
      // =======================
      const logoUrl = '/logo_negro.png'; // en /public
      try {
        const logoDataUrl = await this.cargarImagenComoDataUrl(logoUrl);
        if (logoDataUrl) {
          const logoAncho = 50;
          const logoAlto = 10;
          const logoX = (width - logoAncho) / 2;
          const logoY = 5;

          doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoAncho, logoAlto);
        }
      } catch (e) {
        console.warn('No se pudo cargar el logo del fotocheck', e);
      }

      // =======================
      // CÍRCULO (anillo negro + interior blanco)
      // =======================

      const radioIntermedio = radioFoto + 1; // anillo negro
      const radioInterior = radioFoto - 2;   // fondo blanco de la foto

      // Anillo interior negro (sobre el fondo)
      doc.setFillColor(negro);
      doc.circle(centroX, centroY, radioIntermedio, 'F');

      // Centro blanco donde va la foto
      doc.setFillColor(blanco);
      doc.circle(centroX, centroY, radioInterior, 'F');

      // =======================
      // FOTO DEL EMPLEADO
      // =======================
      const fotoDataUrl = await this.cargarImagenComoDataUrl(emp.foto_perfil_url);
      if (fotoDataUrl) {
        const fotoSize = radioInterior * 2;
        const fotoMargin = 8; // margen para que no se salga

        doc.addImage(
          fotoDataUrl,
          'JPEG',
          centroX - radioInterior + fotoMargin,
          centroY - radioInterior + fotoMargin,
          fotoSize - fotoMargin * 2,
          fotoSize - fotoMargin * 2,
        );
      }

      // =======================
      // NOMBRE Y APELLIDOS
      // =======================
      const nombreLinea = (emp.nombre || '').toUpperCase();
      const apellidosLinea = `${emp.apellido_paterno || ''} ${
        emp.apellido_materno || ''
      }`
        .trim()
        .toUpperCase();

      doc.setTextColor(blanco);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(nombreLinea, width / 2, 84, { align: 'center' });

      doc.setFontSize(15);
      doc.text(apellidosLinea, width / 2, 92, { align: 'center' });

      // =======================
      // CÓDIGO DE BARRAS
      // =======================
      if (emp.barcode_url) {
        const barcodeDataUrl = await this.cargarImagenComoDataUrl(
          emp.barcode_url,
        );

        if (barcodeDataUrl) {
          const barraY = 98;
          const barraAltura = 18;
          const barraAncho = width * 0.82;
          const barraX = (width - barraAncho) / 2;

          doc.setFillColor(blanco);
          doc.roundedRect(barraX, barraY, barraAncho, barraAltura, 2, 2, 'F');

          doc.addImage(
            barcodeDataUrl,
            'PNG',
            barraX + 2,
            barraY + 1.5,
            barraAncho - 4,
            barraAltura - 3,
          );
        }
      }

      // =======================
      // BANDA INFERIOR CON ÁREA
      // =======================
      const bandaAlto = 14;
      const bandaY = height - bandaAlto;

      doc.setFillColor(amarillo);
      doc.rect(0, bandaY, width, bandaAlto, 'F');

      doc.setTextColor(negro);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const rolTexto = (emp.area || '').toUpperCase();
      doc.text(rolTexto, width / 2, bandaY + bandaAlto / 2 + 3, {
        align: 'center',
      });

      const nombreArchivo = `fotocheck-${emp.apellido_paterno || ''}-${
        emp.numero_documento || emp.id
      }.pdf`;
      doc.save(nombreArchivo.replace(/\s+/g, '-'));
    } catch (err) {
      console.error('Error al generar fotocheck', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el fotocheck. Intente nuevamente.',
        background: '#111',
        color: '#f5f5f5',
      });
    } finally {
      this.imprimiendoFotocheck = false;
      
    }
  }

  // ================= FICHA A4 (NUEVA) =================

  async imprimirFichaPdf(): Promise<void> {
    if (!this.empleado?.id) {
      return;
    }

    this.imprimiendoFicha = true;
    

    try {
      const emp = this.empleado;

      // 1) Traer horarios vigentes
      let horarios: any[] = [];
      try {
        horarios = await firstValueFrom(
          this.servicioHorarios.vigente(emp.id),
        );
      } catch (e) {
        console.warn('No se pudieron obtener horarios vigentes', e);
      }

      // 2) Crear PDF A4
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const margen = 15;
      const columnaAncho = (pageWidth - margen * 2) / 2;

      const amarillo = '#f6c326';
      const negro = '#111111';

      // ===== CABECERA (LOGO + TÍTULO) =====
      const logoUrl = '/logo_negro.png';
      const logoDataUrl = await this.cargarImagenComoDataUrl(logoUrl);
      let yActual = 15;

      if (logoDataUrl) {
        const logoAncho = 30;
        const logoAlto = 10;
        doc.addImage(
          logoDataUrl,
          'PNG',
          margen,
          yActual,
          logoAncho,
          logoAlto,
        );
      }

      doc.setTextColor(negro);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(
        'Ficha de empleado',
        pageWidth - margen,
        yActual + 7,
        { align: 'right' },
      );

      yActual += 18;

      // línea separadora
      doc.setDrawColor(amarillo);
      doc.setLineWidth(0.7);
      doc.line(margen, yActual, pageWidth - margen, yActual);
      yActual += 6;

      // ===== COLUMNA IZQUIERDA: Foto + códigos =====
      const xIzq = margen;
      let yIzq = yActual;

      // FOTO
      if (emp.foto_perfil_url) {
        const fotoDataUrl = await this.cargarImagenComoDataUrl(
          emp.foto_perfil_url,
        );
        if (fotoDataUrl) {
          const fotoAncho = 45;
          const fotoAlto = 60;
          doc.setDrawColor(amarillo);
          doc.setLineWidth(0.8);
          doc.rect(xIzq, yIzq, fotoAncho, fotoAlto);
          doc.addImage(
            fotoDataUrl,
            'JPEG',
            xIzq,
            yIzq,
            fotoAncho,
            fotoAlto,
          );
          yIzq += fotoAlto + 6;
        }
      }

      // Código de barras
      if (emp.barcode_url) {
        const barcodeDataUrl = await this.cargarImagenComoDataUrl(
          emp.barcode_url,
        );
        if (barcodeDataUrl) {
          doc.setFontSize(11);
          doc.setTextColor(negro);
          doc.setFont('helvetica', 'bold');
          doc.text('Código de barras', xIzq, yIzq);
          yIzq += 3;

          const boxAncho = 55;
          const boxAlto = 18;
          const boxX = xIzq;
          const boxY = yIzq;

          doc.setDrawColor(amarillo);
          doc.setLineWidth(0.5);
          doc.rect(boxX, boxY, boxAncho, boxAlto);

          doc.addImage(
            barcodeDataUrl,
            'PNG',
            boxX + 2,
            boxY + 2,
            boxAncho - 4,
            boxAlto - 4,
          );
          yIzq += boxAlto + 8;
        }
      }

      // Código QR
      if (emp.qr_url) {
        const qrDataUrl = await this.cargarImagenComoDataUrl(emp.qr_url);
        if (qrDataUrl) {
          doc.setFontSize(11);
          doc.setTextColor(negro);
          doc.setFont('helvetica', 'bold');
          doc.text('Código QR', xIzq, yIzq);
          yIzq += 3;

          const qrSize = 35;
          doc.setDrawColor(amarillo);
          doc.setLineWidth(0.5);
          doc.rect(xIzq, yIzq, qrSize, qrSize);

          doc.addImage(
            qrDataUrl,
            'PNG',
            xIzq + 2,
            yIzq + 2,
            qrSize - 4,
            qrSize - 4,
          );

          yIzq += qrSize + 4;
        }
      }

      // ===== COLUMNA DERECHA: Datos personales / laborales =====
      const xDer = margen + columnaAncho;
      let yDer = yActual;

      const drawCampo = (label: string, valor: string) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(amarillo);
        doc.text(label, xDer, yDer);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(negro);
        doc.text(valor || '-', xDer, yDer + 4);

        yDer += 9;
      };

      // Título bloque
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(negro);
      doc.text('Datos personales y laborales', xDer, yDer);
      yDer += 6;

      const nombreCompleto = `${emp.nombre || ''} ${
        emp.apellido_paterno || ''
      } ${emp.apellido_materno || ''}`.trim();

      drawCampo('Nombre completo', nombreCompleto);
      drawCampo(
        'Documento',
        `${emp.tipo_documento || ''} - ${emp.numero_documento || ''}`,
      );
      drawCampo('Teléfono', emp.telefono_celular || '');
      drawCampo('Correo personal', emp.email_personal || '');
      drawCampo('Correo institucional', emp.email_institucional || '');
      drawCampo('Rol', emp.rol || '');
      drawCampo('Área', emp.area || '');
      drawCampo('Sede', emp.sede || '');
      drawCampo(
        'Estado',
        emp.activo ? 'ACTIVO' : 'INACTIVO',
      );

      // ===== HORARIO VIGENTE =====
      let yHorario = Math.max(yIzq, yDer) + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(negro);
      doc.text('Horario de trabajo vigente', margen, yHorario);
      yHorario += 4;

      doc.setDrawColor(amarillo);
      doc.setLineWidth(0.5);
      doc.line(margen, yHorario, pageWidth - margen, yHorario);
      yHorario += 4;

      if (!horarios || !horarios.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(
          'Sin horario asignado para la fecha vigente.',
          margen,
          yHorario,
        );
      } else {
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
        let yFila = yHorario;

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
          }

          doc.text(diaNombre, colDiaX, yFila);
          if (turno1) doc.text(turno1, colTurno1X, yFila);
          if (turno2) doc.text(turno2, colTurno2X, yFila);
          if (obs) doc.text(obs, colObsX, yFila);

          yFila += 6;
        }
      }

      // ===== PIE DE PÁGINA =====
      const pieY = pageHeight - 10;
      doc.setFontSize(8);
      doc.setTextColor('#555555');
      doc.text(
        `Generado por Registro de Asistencia - ${new Date().toLocaleString()}`,
        margen,
        pieY,
      );

      const nombreArchivo = `ficha-empleado-${
        emp.apellido_paterno || ''
      }-${emp.numero_documento || emp.id}.pdf`;
      doc.save(nombreArchivo.replace(/\s+/g, '-'));
    } catch (err) {
      console.error('Error generando ficha PDF', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar la ficha PDF. Intente nuevamente.',
        background: '#111',
        color: '#f5f5f5',
      });
    } finally {
      this.imprimiendoFicha = false;
      
    }
  }
}

