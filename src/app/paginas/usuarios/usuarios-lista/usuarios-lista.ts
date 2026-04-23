import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';

import { ServicioUsuarios } from '../../../nucleo/servicios/servicio-usuarios';
import { ModalUsuarioComponent } from '../modal-usuario/modal-usuario';
import { FormsModule } from '@angular/forms';
import Swal from '../../../nucleo/servicios/alerta-tema';

@Component({
  selector: 'app-usuarios-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalUsuarioComponent],
  templateUrl: './usuarios-lista.html',
  styleUrls: ['./usuarios-lista.scss'],
})
export class UsuariosListar implements OnInit {
  usuarios: any[] = [];

  cargandoLista = false;
  procesandoAccion = false;

  errorCarga = false;
  terminoBusqueda: string = '';
  filtroEstado: 'todos' | 'activos' | 'inactivos' = 'todos';
  filtroSede: string = 'todas';

  tamanoPagina = 20;
  opcionesTamanoPagina = [20, 50, 100];
  paginaActual = 1;

  mostrandoModal = false;
  usuarioEditando: any | null = null;
  modoModal: 'crear' | 'editar' = 'crear';

  constructor(private servicioUsuarios: ServicioUsuarios) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  get sedesDisponibles(): string[] {
    return [...new Set(this.usuarios.map((u) => String(u?.sede_nombre || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  get usuariosFiltrados(): any[] {
    const termino = this.terminoBusqueda.trim().toLowerCase();

    return this.usuarios.filter((u) => {
      const coincideTexto =
        !termino ||
        [
          u?.nombre,
          u?.apellido_paterno,
          u?.apellido_materno,
          u?.numero_documento,
          u?.email_personal,
          u?.rol,
          u?.sede_nombre,
          u?.area_nombre,
        ]
          .filter(Boolean)
          .some((valor) => String(valor).toLowerCase().includes(termino));

      const coincideEstado =
        this.filtroEstado === 'todos' ||
        (this.filtroEstado === 'activos' && u?.activo === true) ||
        (this.filtroEstado === 'inactivos' && u?.activo === false);

      const coincideSede =
        this.filtroSede === 'todas' ||
        String(u?.sede_nombre || '').trim().toLowerCase() === this.filtroSede.toLowerCase();

      return coincideTexto && coincideEstado && coincideSede;
    });
  }

  get totalUsuarios(): number {
    return this.usuariosFiltrados.length;
  }

  get usuariosActivos(): number {
    return this.usuariosFiltrados.filter((u) => u?.activo === true).length;
  }

  get usuariosInactivos(): number {
    return this.usuariosFiltrados.filter((u) => u?.activo === false).length;
  }

  get usuariosPracticantes(): number {
    return this.usuariosFiltrados.filter(
      (u) => String(u?.rol || '').trim().toLowerCase() === 'practicante',
    ).length;
  }

  porcentajeResumen(valor: number): string {
    if (!this.totalUsuarios) return '0% del total';
    return `${((valor / this.totalUsuarios) * 100).toFixed(1)}% del total`;
  }

  claseTipoDocumento(tipo: unknown): string {
    const normalizado = String(tipo || '').trim().toLowerCase();

    if (normalizado === 'ce') return 'badge-tipo--ce';
    if (normalizado === 'dni') return 'badge-tipo--dni';
    if (normalizado === 'pasaporte') return 'badge-tipo--pasaporte';

    return 'badge-tipo--default';
  }

  get usuariosPaginados(): any[] {
    const inicio = (this.paginaActual - 1) * this.tamanoPagina;
    const fin = inicio + this.tamanoPagina;
    return this.usuariosFiltrados.slice(inicio, fin);
  }

  get totalRegistros(): number {
    return this.usuariosFiltrados.length;
  }

  get totalPaginas(): number {
    if (!this.totalRegistros || !this.tamanoPagina) return 1;
    return Math.max(1, Math.ceil(this.totalRegistros / this.tamanoPagina));
  }

  get rangoInicio(): number {
    if (!this.totalRegistros) return 0;
    return (this.paginaActual - 1) * this.tamanoPagina + 1;
  }

  get rangoFin(): number {
    if (!this.totalRegistros) return 0;
    return Math.min(this.paginaActual * this.tamanoPagina, this.totalRegistros);
  }

  cargarUsuarios(texto?: string): void {
    if (this.cargandoLista) return;

    this.cargandoLista = true;
    this.errorCarga = false;

    this.servicioUsuarios
      .listar(texto)
      .pipe(finalize(() => (this.cargandoLista = false)))
      .subscribe({
        next: (resp) => {
          this.usuarios = resp || [];
          this.paginaActual = 1;
        },
        error: () => {
          this.errorCarga = true;
          this.usuarios = [];
          this.paginaActual = 1;
        },
      });
  }

  ejecutarBusqueda(): void {
    this.paginaActual = 1;
  }

  aplicarFiltros(): void {
    this.paginaActual = 1;
  }

  limpiarFiltros(): void {
    this.filtroEstado = 'todos';
    this.filtroSede = 'todas';
    this.aplicarFiltros();
  }

  exportarUsuarios(): void {
    const filas = this.usuariosFiltrados.map((u) => ({
      nombre: [u?.nombre, u?.apellido_paterno, u?.apellido_materno].filter(Boolean).join(' ').trim(),
      documento: u?.numero_documento || '',
      tipo_documento: u?.tipo_documento || '',
      correo_personal: u?.email_personal || '',
      telefono: u?.telefono_celular || '',
      rol: u?.rol || '',
      sede: u?.sede_nombre || '',
      area: u?.area_nombre || '',
      estado: u?.activo ? 'Activo' : 'Inactivo',
    }));

    const encabezados = [
      'Nombre completo',
      'Documento',
      'Tipo documento',
      'Correo personal',
      'Telefono',
      'Rol',
      'Sede',
      'Area',
      'Estado',
    ];

    const escaparHtml = (valor: unknown) =>
      String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const filasHtml = filas
      .map(
        (fila) => `
          <tr>
            <td>${escaparHtml(fila.nombre)}</td>
            <td>${escaparHtml(fila.documento)}</td>
            <td>${escaparHtml(fila.tipo_documento)}</td>
            <td>${escaparHtml(fila.correo_personal)}</td>
            <td>${escaparHtml(fila.telefono)}</td>
            <td>${escaparHtml(fila.rol)}</td>
            <td>${escaparHtml(fila.sede)}</td>
            <td>${escaparHtml(fila.area)}</td>
            <td>${escaparHtml(fila.estado)}</td>
          </tr>
        `,
      )
      .join('');

    const htmlExcel = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8" />
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #d7dce5; padding: 8px 10px; font-family: Arial, sans-serif; font-size: 12px; }
            th { background: #ffd400; color: #111827; font-weight: 700; }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr>${encabezados.map((col) => `<th>${escaparHtml(col)}</th>`).join('')}</tr>
            </thead>
            <tbody>${filasHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlExcel], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'usuarios_filtrados.xls';
    enlace.click();
    URL.revokeObjectURL(url);
  }

  cambiarTamanoPagina(nuevoTamano: number): void {
    this.tamanoPagina = nuevoTamano || 20;
    this.paginaActual = 1;
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) this.paginaActual--;
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) this.paginaActual++;
  }

  abrirNuevo(): void {
    this.usuarioEditando = null;
    this.modoModal = 'crear';
    this.mostrandoModal = true;
  }

  abrirEditar(usuario: any): void {
    this.usuarioEditando = { ...usuario };
    this.modoModal = 'editar';
    this.mostrandoModal = true;
  }

  onCancelarModal(): void {
    this.mostrandoModal = false;
    this.usuarioEditando = null;
  }

  onGuardado(): void {
    this.mostrandoModal = false;
    this.usuarioEditando = null;
    const texto = this.terminoBusqueda.trim();
    this.cargarUsuarios(texto || undefined);
  }

  // ✅ Actualiza el item dentro del array y fuerza repaint (cambia referencia)
  private setActivoEnLista(userId: string, activo: boolean) {
    this.usuarios = this.usuarios.map((x) =>
      x.id === userId ? { ...x, activo } : x,
    );
  }

  async cambiarEstadoUsuario(u: any): Promise<void> {
    if (this.procesandoAccion) return;

    const nuevoEstado = !u.activo;
    const accionTexto = nuevoEstado ? 'reactivar' : 'dar de baja';

    const resultado = await Swal.fire({
      title: `¿Desea ${accionTexto} a este usuario?`,
      text: nuevoEstado
        ? 'El usuario volverá a estar activo en el sistema.'
        : 'El usuario será marcado como inactivo y ya no podrá marcar asistencia.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accionTexto}`,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });

    if (!resultado.isConfirmed) return;

    this.procesandoAccion = true;

    const estadoAnterior = !!u.activo;

    // ✅ 1) Optimista: reflejar el cambio en UI INMEDIATAMENTE
    this.setActivoEnLista(u.id, nuevoEstado);

    this.servicioUsuarios
      .cambiarEstado(u.id, nuevoEstado)
      .pipe(finalize(() => (this.procesandoAccion = false)))
      .subscribe({
        next: async (resp) => {
          // ✅ 2) Confirmar con backend si devuelve usuario actualizado
          const activoFinal =
            typeof resp?.activo === 'boolean' ? resp.activo : nuevoEstado;

          this.setActivoEnLista(u.id, activoFinal);

          await Swal.fire({
            icon: 'success',
            title: nuevoEstado ? 'Usuario reactivado' : 'Usuario dado de baja',
            text: nuevoEstado
              ? 'El usuario ahora está activo.'
              : 'El usuario fue marcado como inactivo.',
            timer: 1400,
            showConfirmButton: false,
          });

          // ✅ 3) Recargar lista (con cache-bust desde el service)
          const texto = this.terminoBusqueda.trim();
          this.cargarUsuarios(texto || undefined);
        },
        error: (err) => {
          console.error('Error al cambiar estado del usuario:', err);

          // ✅ Revertir en UI si falló
          this.setActivoEnLista(u.id, estadoAnterior);

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cambiar el estado del usuario. Intente nuevamente.',
          });
        },
      });
  }
}
