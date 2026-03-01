import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ServicioAutenticacion } from '../servicios/servicio-autenticacion';

export function guardianRolesGuard(rolesPermitidos: string[]): CanActivateFn {
  return () => {
    const auth = inject(ServicioAutenticacion);
    const router = inject(Router);

    if (!auth.estaAutenticado()) {
      return router.createUrlTree(['/inicio-sesion']);
    }

    const usuario = auth.obtenerUsuario();
    const rolActual = (usuario?.rol || '').trim(); // 👈 importante el trim()

    if (!rolActual) {
      return router.createUrlTree(['/panel/inicio']);
    }

    // ✅ Normalizamos para evitar problemas RRHH vs rrhh vs espacios
    const rolNorm = rolActual.toUpperCase();
    const permitidosNorm = rolesPermitidos.map(r => r.toUpperCase());

    if (!permitidosNorm.includes(rolNorm)) {
      return router.createUrlTree(['/panel/inicio']);
    }

    return true;
  };
}
