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
import { ServicioSedes } from '../../nucleo/servicios/servicio-sedes';

@Component({
  selector: 'app-sedes-lista',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sedes-lista.html',
  styleUrls: ['./sedes-lista.scss'],
})
export class SedesListaComponent implements OnInit {
  sedes: any[] = [];
  cargando = false;
  errorCarga = false;

  // ✅ Estados separados
  cargandoLista = false;
  procesandoAccion = false;

  // Modal / formulario
  mostrandoModal = false;
  sedeEditando: any | null = null;
  formulario: FormGroup;

  constructor(
    private fb: FormBuilder,
    private servicioSedes: ServicioSedes,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {
    this.formulario = this.fb.group({
      nombre: ['', Validators.required],
      activo: [true],
    });
  }

  ngOnInit(): void {
    this.cargarSedes();
  }

  /** ✅ Fuerza repintado (evita “pegado”) */
  private refrescarUI(): void {
    this.zone.run(() => {
      Promise.resolve().then(() => this.cdr.detectChanges());
    });
  }

  cargarSedes(): void {
    if (this.cargandoLista) return;

    this.cargandoLista = true;
    this.cargando = true;
    this.errorCarga = false;

    this.servicioSedes
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
          this.sedes = lista || [];
          this.refrescarUI();
        },
        error: (err) => {
          console.error('[SedesLista] Error al cargar sedes:', err);
          this.errorCarga = true;
          this.sedes = [];
          this.refrescarUI();
        },
      });
  }

  // ---------- MODAL NUEVA / EDITAR ----------
  abrirNueva(): void {
    this.sedeEditando = null;
    this.formulario.reset({
      nombre: '',
      activo: true,
    });
    this.mostrandoModal = true;
    this.refrescarUI();
  }

  abrirEditar(sede: any): void {
    this.sedeEditando = { ...sede };
    this.formulario.reset({
      nombre: sede.nombre || '',
      activo: sede.activo ?? true,
    });
    this.mostrandoModal = true;
    this.refrescarUI();
  }

  cerrarModal(): void {
    this.mostrandoModal = false;
    this.sedeEditando = null;
    this.refrescarUI();
  }

  /** ✅ Patch inmediato a la lista */
  private patchSedeEnLista(sedeId: string, patch: any) {
    this.sedes = this.sedes.map((x) => (x.id === sedeId ? { ...x, ...patch } : x));
    this.refrescarUI();
  }

  /** ✅ Snapshot para reabrir si cancelan o falla */
  private snapshotModal() {
    return {
      sedeEditando: this.sedeEditando ? { ...this.sedeEditando } : null,
      formValue: this.formulario.getRawValue(),
    };
  }

  private restoreModal(snap: { sedeEditando: any | null; formValue: any }) {
    this.sedeEditando = snap.sedeEditando ? { ...snap.sedeEditando } : null;
    this.formulario.reset({
      nombre: snap.formValue?.nombre ?? '',
      activo: snap.formValue?.activo ?? true,
    });
    this.mostrandoModal = true;
    this.refrescarUI();
  }

  async guardarSede(): Promise<void> {
    if (this.procesandoAccion) return;

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const esEdicion = !!this.sedeEditando;
    const textoAccion = esEdicion ? 'actualizar esta sede' : 'crear esta sede';

    // ✅ 1) snapshot
    const snap = this.snapshotModal();

    // ✅ 2) cerrar modal antes del Swal
    this.cerrarModal();

    // ✅ 3) confirmación
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

    // si cancelan, reabrimos modal con datos
    if (!confirm.isConfirmed) {
      this.restoreModal(snap);
      return;
    }

    this.procesandoAccion = true;

    const datos = snap.formValue;

    const peticion$ = esEdicion
      ? this.servicioSedes.actualizar(snap.sedeEditando!.id, datos)
      : this.servicioSedes.crear(datos);

    peticion$
      .pipe(finalize(() => (this.procesandoAccion = false)))
      .subscribe({
        next: async (resp: any) => {
          // ✅ UI inmediata
          if (esEdicion) {
            const id = snap.sedeEditando!.id;
            if (resp && resp.id) {
              this.patchSedeEnLista(id, resp);
            } else {
              this.patchSedeEnLista(id, {
                nombre: datos.nombre,
                activo: datos.activo,
              });
            }
          }

          await Swal.fire({
            icon: 'success',
            title: esEdicion ? 'Sede actualizada' : 'Sede creada',
            text: esEdicion
              ? 'Los datos de la sede se actualizaron correctamente.'
              : 'La sede se registró correctamente.',
            timer: 1400,
            showConfirmButton: false,
            background: '#111',
            color: '#f5f5f5',
          });

          // ✅ refresco final
          this.cargarSedes();
        },
        error: (err) => {
          console.error('[SedesLista] Error al guardar sede:', err);

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text:
              err?.error?.message ||
              'Ocurrió un error al guardar la sede. Intente nuevamente.',
            background: '#111',
            color: '#f5f5f5',
          });

          // ✅ reabrir modal con lo editado
          this.restoreModal(snap);
        },
      });
  }

  async desactivar(sede: any): Promise<void> {
    if (this.procesandoAccion) return;

    const confirm = await Swal.fire({
      title: 'Confirmar desactivación',
      text: `¿Desea desactivar la sede "${sede.nombre}"?`,
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

    // ✅ UI inmediata
    const estadoAnterior = !!sede.activo;
    this.patchSedeEnLista(sede.id, { activo: false });

    this.servicioSedes
      .desactivar(sede.id)
      .pipe(finalize(() => (this.procesandoAccion = false)))
      .subscribe({
        next: async () => {
          await Swal.fire({
            icon: 'success',
            title: 'Sede desactivada',
            text: 'La sede se desactivó correctamente.',
            timer: 1400,
            showConfirmButton: false,
            background: '#111',
            color: '#f5f5f5',
          });

          this.cargarSedes();
        },
        error: (err) => {
          console.error('[SedesLista] Error al desactivar sede:', err);

          // revertir
          this.patchSedeEnLista(sede.id, { activo: estadoAnterior });

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text:
              err?.error?.message ||
              'Ocurrió un error al desactivar la sede. Intente nuevamente.',
            background: '#111',
            color: '#f5f5f5',
          });
        },
      });
  }
}
