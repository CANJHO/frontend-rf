import {
  Component,
  NgZone,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ServicioAutenticacion } from '../../nucleo/servicios/servicio-autenticacion';

@Component({
  selector: 'app-inicio-sesion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './inicio-sesion.html',
  styleUrls: ['./inicio-sesion.scss'],
})
export class InicioSesionComponent {
  formulario: FormGroup;
  estaCargando = false;
  mensajeError: string | null = null;
  passwordVisible = false;

  @ViewChild('inputUsuario') inputUsuario!: ElementRef<HTMLInputElement>;

  togglePasswordVisible() {
    this.passwordVisible = !this.passwordVisible;
    
  }

  constructor(
    private fb: FormBuilder,
    private servicioAutenticacion: ServicioAutenticacion,
    private enrutador: Router,
    private ngZone: NgZone,
    
  ) {
    this.formulario = this.fb.group({
      usuario: ['', Validators.required],
      contrasenia: ['', Validators.required],
    });
  }

  iniciarSesion() {
    if (this.formulario.invalid || this.estaCargando) return;

    this.estaCargando = true;
    this.mensajeError = null;
    

    const { usuario, contrasenia } = this.formulario.value;

    this.servicioAutenticacion
      .iniciarSesion(usuario, contrasenia)
      .subscribe({
        next: (resp) => {
          this.ngZone.run(() => {
            this.estaCargando = false;

            const rol = (resp.usuario.rol || '').toUpperCase();

            if (rol === 'RRHH' || rol === 'GERENCIA') {
              this.enrutador.navigate(['/panel']);
            } else {
              this.servicioAutenticacion.cerrarSesion();
              this.mensajeError =
                'Su rol no tiene acceso al panel del sistema.';
            }

           
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.estaCargando = false;

            if (err.status === 401) {
              this.mensajeError = 'Usuario o contraseña incorrectos.';
            } else {
              this.mensajeError =
                'Ocurrió un error al iniciar sesión. Intente nuevamente.';
            }

            this.formulario.reset();
            this.formulario.markAsPristine();
            this.formulario.markAsUntouched();

            if (this.inputUsuario?.nativeElement) {
              this.inputUsuario.nativeElement.focus();
            }

            
          });
        },
      });
  }
}
