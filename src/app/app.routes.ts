import { Routes } from '@angular/router';
import { InicioSesionComponent } from './paginas/inicio-sesion/inicio-sesion';
import { KioskoMarcajeComponent } from './paginas/kiosko-marcaje/kiosko-marcaje';
import { PanelPrincipalComponent } from './paginas/panel-principal/panel-principal';
import { PanelInicioComponent } from './paginas/panel-inicio/panel-inicio';
import { AreasListaComponent } from './paginas/areas/areas-lista';
import { SedesListaComponent } from './paginas/sedes/sedes-lista';
import { ReporteUsuariosComponent } from './paginas/reportes/reporte-usuarios/reporte-usuarios';

// GUARD
import { guardianAutenticacionGuard } from './nucleo/guardianes/guardian-autenticacion-guard';
import { guardianRolesGuard } from './nucleo/guardianes/guardian-roles-guard';

// Componentes
import { UsuariosListar } from './paginas/usuarios/usuarios-lista/usuarios-lista';
import { EmpleadosListaComponent } from './paginas/empleados/empleados-lista/empleados-lista';
import { FichaEmpleadoComponent } from './paginas/empleados/ficha-empleado/ficha-empleado';
import { EmpleadoHorarioComponent } from './paginas/empleados/empleado-horario/empleado-horario';

export const rutasAplicacion: Routes = [
  // 🔐 Login
  { path: 'inicio-sesion', component: InicioSesionComponent },

  // 🕒 Kiosko público (libre, sin login)
  { path: 'kiosko', component: KioskoMarcajeComponent },

  // 📊 Panel principal protegido 🔐
  {
    path: 'panel',
    component: PanelPrincipalComponent,
    canActivate: [guardianAutenticacionGuard],
    runGuardsAndResolvers: 'always',
    children: [
      // Página por defecto del panel
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },

      // Inicio del panel
      { path: 'inicio', component: PanelInicioComponent },

      // Usuarios
      { path: 'usuarios', component: UsuariosListar },

      // Áreas
      { path: 'areas', component: AreasListaComponent },

      // Sedes
      { path: 'sedes', component: SedesListaComponent },

      // Empleados
      {
        path: 'empleados/asistencias/:usuarioId/:fecha',
        canActivate: [guardianRolesGuard(['RRHH', 'Gerencia'])],
        loadComponent: () =>
          import('./paginas/rrhh/asistencias-dia/asistencias-dia')
            .then((m) => m.AsistenciasDiaComponent),
      },
            // ✅ NUEVO: Asistencias (RRHH/Gerencia) dentro de EMPLEADOS
      {
        path: 'empleados/asistencias',
        canActivate: [guardianRolesGuard(['RRHH', 'Gerencia'])],
        loadComponent: () =>
          import('./paginas/rrhh/asistencias-bandeja/asistencias-bandeja')
            .then((m) => m.AsistenciasBandejaComponent),
      },
      { path: 'empleados/:id/horario', component: EmpleadoHorarioComponent },
      { path: 'empleados/:id', component: FichaEmpleadoComponent },
      { path: 'empleados', component: EmpleadosListaComponent },
     
      // Reportes
      { path: 'reportes/usuarios', component: ReporteUsuariosComponent },
      { path: 'reportes/asistencias',
        loadComponent: () =>
        import('./paginas/reportes/reporte-asistencias/reporte-asistencias')
        .then((m) => m.ReporteAsistenciasComponent),
      },
      {
        path: 'reportes/asistencias-detalle',
        loadComponent: () =>
          import('./paginas/reportes/reporte-asistencias-detalle/reporte-asistencias-detalle')
            .then((m) => m.ReporteAsistenciasDetalleComponent),
      },

    ],
  },

  // Redirección raíz
  { path: '', pathMatch: 'full', redirectTo: 'inicio-sesion' },

  // Cualquier ruta no encontrada
  { path: '**', redirectTo: 'panel/inicio' }

];
