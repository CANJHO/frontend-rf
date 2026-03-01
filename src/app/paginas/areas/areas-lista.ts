import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import Swal from 'sweetalert2';
import { ServicioAreas } from '../../nucleo/servicios/servicio-areas';

@Component({
  selector: 'app-areas-lista',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: '../../paginas/areas/areas-lista.html',
  styleUrls: ['../../paginas/areas/areas-lista.scss'],
})
export class AreasListaComponent implements OnInit {
  areas: any[] = [];

  // ✅ Mantengo 'cargando' porque tu HTML lo usa
  cargando = false;

  // ✅ Estados separados
  cargandoLista = false;
  procesandoAccion = false;

  errorCarga = false;

  mostrandoModal = false;
  areaEditando: any | null = null;
  formulario: FormGroup;

  constructor(
    private fb: FormBuilder,
    private servicioAreas: ServicioAreas,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {
    this.formulario = this.fb.group({
      nombre: ['', Validators.required],
      activo: [true],
    });
  }

  ngOnInit(): void {
    this.cargarAreas();
  }

  /** ✅ Fuerza repintado (evita que “se quede pegado”) */
  private refrescarUI(): void {
    // Asegura que corra dentro de Angular
    this.zone.run(() => {
      // microtask para que el DOM ya tenga los cambios del array
      Promise.resolve().then(() => {
        this.cdr.detectChanges();
      });
    });
  }

  cargarAreas(): void {
    if (this.cargandoLista) return;

    this.cargandoLista = true;
    this.cargando = true;
    this.errorCarga = false;

    this.servicioAreas
      .listar()
      .pipe(
        finalize(() => {
          this.cargandoLista = false;
          this.cargando = false;
          this.refrescarUI();
        }),
      )
      .subscribe({
        next: (lista) => {
          this.areas = lista || [];
          this.refrescarUI();
        },
        error: (err) => {
          console.error('[AreasLista] Error al cargar áreas:', err);
          this.errorCarga = true;
          this.areas = [];
          this.refrescarUI();
        },
      });
  }

  // ---------- MODAL NUEVA / EDITAR ----------
  abrirNueva(): void {
    this.areaEditando = null;
    this.formulario.reset({
      nombre: '',
      activo: true,
    });
    this.mostrandoModal = true;
    this.refrescarUI();
  }

  abrirEditar(area: any): void {
    this.areaEditando = { ...area };
    this.formulario.reset({
      nombre: area.nombre || '',
      activo: area.activo ?? true,
    });
    this.mostrandoModal = true;
    this.refrescarUI();
  }

  cerrarModal(): void {
    this.mostrandoModal = false;
    this.areaEditando = null;
    this.refrescarUI();
  }

  // ✅ helper: update UI inmediata
  private patchAreaEnLista(areaId: string, patch: any) {
    this.areas = this.areas.map((x) =>
      x.id === areaId ? { ...x, ...patch } : x,
    );
    this.refrescarUI();
  }

  // ✅ Guarda el estado del modal para reabrirlo si cancelan o falla
  private snapshotModal() {
    return {
      areaEditando: this.areaEditando ? { ...this.areaEditando } : null,
      formValue: this.formulario.getRawValue(),
    };
  }

  private restoreModal(snap: { areaEditando: any | null; formValue: any }) {
    this.areaEditando = snap.areaEditando ? { ...snap.areaEditando } : null;
    this.formulario.reset({
      nombre: snap.formValue?.nombre ?? '',
      activo: snap.formValue?.activo ?? true,
    });
    this.mostrandoModal = true;
    this.refrescarUI();
  }

  async guardarArea(): Promise<void> {
    if (this.procesandoAccion) return;

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const esEdicion = !!this.areaEditando;
    const textoAccion = esEdicion ? 'actualizar esta área' : 'crear esta área';

    const snap = this.snapshotModal();

    // ✅ Cerrar modal ANTES del confirm
    this.cerrarModal();

    const confirm = await Swal.fire({
      title: esEdicion ? 'Confirmar actualización' : 'Confirmar creación',
      text: `¿Desea ${textoAccion}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: esEdicion ? 'Sí, actualizar' : 'Sí, crear',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      background: '#111',
      color: '#f5f5f5',
    });

    if (!confirm.isConfirmed) {
      this.restoreModal(snap);
      return;
    }

    this.procesandoAccion = true;

    const datos = snap.formValue;

    const peticion$ = esEdicion
      ? this.servicioAreas.actualizar(snap.areaEditando!.id, datos)
      : this.servicioAreas.crear(datos);

    peticion$
      .pipe(finalize(() => (this.procesandoAccion = false)))
      .subscribe({
        next: async (resp: any) => {
          // ✅ 1) Actualiza UI inmediatamente (sin recargar página)
          if (esEdicion) {
            const id = snap.areaEditando!.id;

            // Si el backend devuelve el objeto actualizado, úsalo.
            // Si no, actualiza con lo que el usuario envió.
            if (resp && resp.id) {
              this.patchAreaEnLista(id, resp);
            } else {
              this.patchAreaEnLista(id, {
                nombre: datos.nombre,
                activo: datos.activo,
              });
            }
          } else {
            // Si es creación: recarga para traer el nuevo registro con su id
            // (puedes optimizar insertándolo en el array si quieres)
          }

          // ✅ 2) Mensaje
          await Swal.fire({
            icon: 'success',
            title: esEdicion ? 'Área actualizada' : 'Área creada',
            text: esEdicion
              ? 'Los datos del área se actualizaron correctamente.'
              : 'El área se registró correctamente.',
            timer: 1400,
            showConfirmButton: false,
            background: '#111',
            color: '#f5f5f5',
          });

          // ✅ 3) Refresco final para mantener consistencia (idempotente)
          this.cargarAreas();
        },
        error: (err) => {
          console.error('[AreasLista] Error al guardar área:', err);

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text:
              err?.error?.message ||
              'Ocurrió un error al guardar el área. Intente nuevamente.',
            background: '#111',
            color: '#f5f5f5',
          });

          this.restoreModal(snap);
        },
      });
  }

  async desactivar(area: any): Promise<void> {
    if (this.procesandoAccion) return;

    const confirm = await Swal.fire({
      title: 'Confirmar desactivación',
      text: `¿Desea desactivar el área "${area.nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      background: '#111',
      color: '#f5f5f5',
    });

    if (!confirm.isConfirmed) return;

    this.procesandoAccion = true;

    const estadoAnterior = !!area.activo;

    // ✅ UI inmediata
    this.patchAreaEnLista(area.id, { activo: false });

    this.servicioAreas
      .desactivar(area.id)
      .pipe(finalize(() => (this.procesandoAccion = false)))
      .subscribe({
        next: async () => {
          await Swal.fire({
            icon: 'success',
            title: 'Área desactivada',
            text: 'El área se desactivó correctamente.',
            timer: 1400,
            showConfirmButton: false,
            background: '#111',
            color: '#f5f5f5',
          });

          this.cargarAreas();
        },
        error: (err) => {
          console.error('[AreasLista] Error al desactivar área:', err);

          // revertir
          this.patchAreaEnLista(area.id, { activo: estadoAnterior });

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text:
              err?.error?.message ||
              'Ocurrió un error al desactivar el área. Intente nuevamente.',
            background: '#111',
            color: '#f5f5f5',
          });
        },
      });
  }
}
