import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import Swal from 'sweetalert2';
import { ServicioUsuarios } from '../../../nucleo/servicios/servicio-usuarios';
import { ServicioSedes } from '../../../nucleo/servicios/servicio-sedes';
import { ServicioAreas } from '../../../nucleo/servicios/servicio-areas';

@Component({
  selector: 'app-modal-usuario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modal-usuario.html',
  styleUrls: ['./modal-usuario.scss'],
})
export class ModalUsuarioComponent implements OnInit, OnChanges {
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardoCambios = new EventEmitter<void>();

  @Input() modo: 'crear' | 'editar' = 'crear';
  @Input() usuarioEditar: any | null = null;

  formulario: FormGroup;

  guardando = false;

  // flags de carga
  cargandoSedes = false;
  cargandoAreas = false;
  get cargandoDatos(): boolean {
    return this.cargandoSedes || this.cargandoAreas;
  }

  roles = [
    { id: 'd17562ec-8672-48c6-9f8a-0c91394d7362', nombre: 'Gerencia' },
    { id: '194bcf0e-3612-40e6-9b6c-e022d9f6d9f5', nombre: 'RRHH' },
    { id: '443a63ab-3df9-4590-923f-21d1813d93d7', nombre: 'Empleado' },
    { id: 'c6431f22-fd88-4fb2-bcc1-571dfee60994', nombre: 'Practicante' },
  ];

  sedes: any[] = [];
  areas: any[] = [];

  constructor(
    private fb: FormBuilder,
    private servicioUsuarios: ServicioUsuarios,
    private servicioSedes: ServicioSedes,
    private servicioAreas: ServicioAreas,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {
    this.formulario = this.fb.group({
      nombre: ['', Validators.required],
      apellido_paterno: ['', Validators.required],
      apellido_materno: ['', Validators.required],

      numero_documento: ['', Validators.required],
      tipo_documento: ['DNI', Validators.required],

      fecha_nacimiento: [''],

      email_personal: ['', [Validators.required, Validators.email]],
      email_institucional: [''],
      telefono_celular: [''],

      rol_id: ['', Validators.required],
      sede_id: ['', Validators.required],
      area_id: ['', Validators.required],

      activo: [true],
    });
  }

  ngOnInit(): void {
    this.cargarSedes();
    this.cargarAreas();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['modo'] && this.modo === 'crear') {
      this.formulario.reset({
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        numero_documento: '',
        tipo_documento: 'DNI',
        fecha_nacimiento: '',
        email_personal: '',
        email_institucional: '',
        telefono_celular: '',
        rol_id: '',
        sede_id: '',
        area_id: '',
        activo: true,
      });
    }

    if (changes['usuarioEditar'] && this.usuarioEditar && this.modo === 'editar') {
      const u = this.usuarioEditar;

      this.formulario.patchValue({
        nombre: u.nombre || '',
        apellido_paterno: u.apellido_paterno || '',
        apellido_materno: u.apellido_materno || '',
        numero_documento: u.numero_documento || '',
        tipo_documento: u.tipo_documento || 'DNI',
        fecha_nacimiento: u.fecha_nacimiento
          ? String(u.fecha_nacimiento).slice(0, 10)
          : '',
        email_personal: u.email_personal || '',
        email_institucional: u.email_institucional || '',
        telefono_celular: u.telefono_celular || '',
        rol_id: u.rol_id || '',
        sede_id: u.sede_id || '',
        area_id: u.area_id || '',
        activo: u.activo ?? true,
      });
    }

    // refresco defensivo
    this.cdr.detectChanges();
  }

  private cargarSedes() {
    this.cargandoSedes = true;
    this.cdr.detectChanges();

    this.servicioSedes.listarActivas().subscribe({
      next: (lista) => {
        this.zone.run(() => {
          this.sedes = lista || [];
          this.cargandoSedes = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Error al cargar sedes activas:', err);

        this.zone.run(() => {
          this.cargandoSedes = false;
          this.cdr.detectChanges();
        });

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las sedes. Intente nuevamente.',
        });
      },
    });
  }

  private cargarAreas() {
    this.cargandoAreas = true;
    this.cdr.detectChanges();

    this.servicioAreas.listarActivas().subscribe({
      next: (lista) => {
        this.zone.run(() => {
          this.areas = lista || [];
          this.cargandoAreas = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Error al cargar áreas activas:', err);

        this.zone.run(() => {
          this.cargandoAreas = false;
          this.cdr.detectChanges();
        });

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las áreas. Intente nuevamente.',
        });
      },
    });
  }

  cerrarModal() {
    if (this.guardando) return;
    this.cerrar.emit();
  }

  async guardarModal() {
    if (this.formulario.invalid) {
      await Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Debe completar todos los campos obligatorios antes de guardar.',
      });
      this.formulario.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    const accion =
      this.modo === 'crear' ? 'crear este usuario' : 'actualizar este usuario';

    const resultado = await Swal.fire({
      title: this.modo === 'crear' ? 'Confirmar creación' : 'Confirmar actualización',
      text: `¿Desea ${accion} con los datos ingresados?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: this.modo === 'crear' ? 'Sí, crear' : 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      allowOutsideClick: false,
      allowEscapeKey: true,
      background: '#111',
      color: '#f5f5f5',
    });

    if (!resultado.isConfirmed) {
      return;
    }

    const datos: any = { ...this.formulario.value };

    if (datos.fecha_nacimiento) {
      datos.fecha_nacimiento = new Date(datos.fecha_nacimiento)
        .toISOString()
        .slice(0, 10);
    } else {
      datos.fecha_nacimiento = null;
    }

    if (this.modo === 'crear') {
      datos.password = datos.numero_documento;
    }

    const peticion$ =
      this.modo === 'crear'
        ? this.servicioUsuarios.crear(datos)
        : this.servicioUsuarios.actualizar(this.usuarioEditar.id, datos);

    // IMPORTANTE: setear guardando dentro de zone + forzar CD
    this.zone.run(() => {
      this.guardando = true;
      this.cdr.detectChanges();
    });

    peticion$.subscribe({
      next: async () => {
        this.zone.run(() => {
          this.guardando = false;
          this.cdr.detectChanges();
        });

        await Swal.fire({
          icon: 'success',
          title: this.modo === 'crear' ? 'Usuario creado' : 'Usuario actualizado',
          text:
            this.modo === 'crear'
              ? 'El usuario se registró correctamente.'
              : 'Los datos del usuario se actualizaron correctamente.',
          timer: 1800,
          showConfirmButton: false,
          allowOutsideClick: false,
          background: '#111',
          color: '#f5f5f5',
        });

        // IMPORTANTE: emitir dentro de zone + refrescar
        this.zone.run(() => {
          this.guardoCambios.emit();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.guardando = false;
          this.cdr.detectChanges();
        });

        const errorOriginal = err?.error?.message || '';

        const esDuplicado =
          errorOriginal.includes('duplicate key') ||
          errorOriginal.includes('duplicada') ||
          err?.status === 409;

        if (esDuplicado) {
          Swal.fire({
            icon: 'warning',
            title: 'Documento duplicado',
            text: 'El número de documento ingresado ya está registrado.',
            allowOutsideClick: false,
            background: '#111',
            color: '#f5f5f5',
          });
          return;
        }

        Swal.fire({
          icon: 'error',
          title: 'Error al guardar usuario',
          text:
            errorOriginal ||
            'Ocurrió un error al guardar el usuario. Intente nuevamente.',
          allowOutsideClick: false,
          background: '#111',
          color: '#f5f5f5',
        });
      },
    });
  }
}

