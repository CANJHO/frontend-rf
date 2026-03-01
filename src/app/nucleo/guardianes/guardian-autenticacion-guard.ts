import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ServicioAutenticacion } from '../servicios/servicio-autenticacion';

export const guardianAutenticacionGuard: CanActivateFn = (route, state) => {
  const servicioAutenticacion = inject<ServicioAutenticacion>(ServicioAutenticacion);
  const enrutador = inject(Router);

  if (servicioAutenticacion.estaAutenticado()) {
    return true;
  }

  // Si no está autenticado, lo mandamos al inicio de sesión
  return enrutador.createUrlTree(['/inicio-sesion']);
};

