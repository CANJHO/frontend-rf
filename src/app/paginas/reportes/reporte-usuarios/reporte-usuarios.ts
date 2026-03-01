import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../../config/api.config';

@Component({
  selector: 'app-reporte-usuarios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reporte-usuarios.html',
  styleUrls: ['./reporte-usuarios.scss'],
})
export class ReporteUsuariosComponent {
  descargando = false;
  error: string | null = null;

  private urlExcel = `${API_BASE_URL}/reportes/usuarios-excel`;
  private urlPdf = `${API_BASE_URL}/reportes/usuarios-pdf`;

  constructor(private http: HttpClient) {}

  descargarExcel() {
    if (this.descargando) return;

    this.descargando = true;
    this.error = null;

    this.http.get(this.urlExcel, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.descargando = false;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reporte-usuarios.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error descargando reporte de usuarios', err);
        this.descargando = false;
        this.error = 'No se pudo descargar el reporte. Intente nuevamente.';
      },
    });
  }

  // ✅ PDF usando HttpClient (para que viaje el JWT del interceptor)
  descargarUsuariosPdf() {
    if (this.descargando) return;

    this.descargando = true;
    this.error = null;

    this.http.get(this.urlPdf, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.descargando = false;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reporte-usuarios.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error descargando PDF de usuarios', err);
        this.descargando = false;
        this.error = 'No se pudo descargar el PDF. Intente nuevamente.';
      },
    });
  }
}
