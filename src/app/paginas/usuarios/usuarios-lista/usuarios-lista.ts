import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';

import { ServicioUsuarios } from '../../../nucleo/servicios/servicio-usuarios';
import { ModalUsuarioComponent } from '../modal-usuario/modal-usuario';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

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

  tamanoPagina = 20;
  opcionesTamanoPagina = [20, 50, 100];
  paginaActual = 1;
  totalRegistros = 0;

  mostrandoModal = false;
  usuarioEditando: any | null = null;
  modoModal: 'crear' | 'editar' = 'crear';

  constructor(private servicioUsuarios: ServicioUsuarios) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  get usuariosPaginados(): any[] {
    const inicio = (this.paginaActual - 1) * this.tamanoPagina;
    const fin = inicio + this.tamanoPagina;
    return this.usuarios.slice(inicio, fin);
  }

  get totalPaginas(): number {
    if (!this.totalRegistros || !this.tamanoPagina) return 1;
    return Math.max(1, Math.ceil(this.totalRegistros / this.tamanoPagina));
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
          this.totalRegistros = this.usuarios.length;
          this.paginaActual = 1;
        },
        error: () => {
          this.errorCarga = true;
          this.usuarios = [];
          this.totalRegistros = 0;
          this.paginaActual = 1;
        },
      });
  }

  ejecutarBusqueda(): void {
    const texto = this.terminoBusqueda.trim();
    this.cargarUsuarios(texto || undefined);
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
      background: '#111',
      color: '#f5f5f5',
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
            background: '#111',
            color: '#f5f5f5',
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
            background: '#111',
            color: '#f5f5f5',
          });
        },
      });
  }
}
