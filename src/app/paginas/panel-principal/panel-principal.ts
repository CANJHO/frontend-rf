import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import Swal from '../../nucleo/servicios/alerta-tema';

import { ServicioAutenticacion } from '../../nucleo/servicios/servicio-autenticacion';
import {
  CumpleanosProximoRow,
  ServicioEmpleados,
} from '../../nucleo/servicios/servicio-empleados';

type ThemeMode = 'dark' | 'light';

@Component({
  selector: 'app-panel-principal',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './panel-principal.html',
  styleUrls: ['./panel-principal.scss'],
})
export class PanelPrincipalComponent implements OnInit {
  private readonly themeStorageKey = 'panel-theme';

  usuario$;

  temaActual: ThemeMode = 'dark';
  grupoUsuariosAbierto = false;
  grupoReportesAbierto = false;
  grupoEmpleadosAbierto = false;
  userMenuOpen = false;
  sidebarOpen = false;

  constructor(
    private servicioAutenticacion: ServicioAutenticacion,
    private servicioEmpleados: ServicioEmpleados,
    private enrutador: Router,
  ) {
    this.usuario$ = this.servicioAutenticacion.usuarioActual$;
  }

  async ngOnInit(): Promise<void> {
    this.temaActual = this.obtenerTemaInicial();
    this.aplicarTema(this.temaActual);

    const usuario = await firstValueFrom(
      this.usuario$.pipe(
        filter((u: any) => !!u?.sub),
        take(1),
      ),
    );

    this.mostrarModalCumpleanosSiCorresponde(usuario.sub);
  }

  get temaLabel(): string {
    return this.temaActual === 'dark' ? 'Oscuro' : 'Claro';
  }

  toggleTema(): void {
    this.temaActual = this.temaActual === 'dark' ? 'light' : 'dark';
    this.aplicarTema(this.temaActual);
    localStorage.setItem(this.themeStorageKey, this.temaActual);
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;

    if (this.sidebarOpen && this.userMenuOpen) this.userMenuOpen = false;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  closeSidebarOnMobile() {
    if (window.innerWidth <= 768) this.sidebarOpen = false;
  }

  toggleUserMenu(event: MouseEvent) {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;

    if (this.userMenuOpen && this.sidebarOpen) this.sidebarOpen = false;
  }

  closeUserMenu() {
    this.userMenuOpen = false;
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.userMenuOpen) this.userMenuOpen = false;
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth > 768 && this.sidebarOpen) this.sidebarOpen = false;
  }

  getIniciales(nombre: string, apellido: string) {
    const n = (nombre || '').trim();
    const a = (apellido || '').trim();
    const i1 = n ? n[0].toUpperCase() : '';
    const i2 = a ? a[0].toUpperCase() : '';
    return `${i1}${i2}` || 'U';
  }

  private obtenerTemaInicial(): ThemeMode {
    const guardado = localStorage.getItem(this.themeStorageKey);
    return guardado === 'light' ? 'light' : 'dark';
  }

  private aplicarTema(theme: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private async mostrarModalCumpleanosSiCorresponde(usuarioId: string) {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const fechaKey = `${yyyy}-${mm}-${dd}`;

    const key = `cumple_modal_mostrado_${usuarioId}_${fechaKey}`;
    const yaMostrado = sessionStorage.getItem(key);
    if (yaMostrado === '1') return;

    try {
      const rows = await firstValueFrom(this.servicioEmpleados.cumpleanosProximos(5));
      const lista: CumpleanosProximoRow[] = rows || [];

      if (!lista.length) {
        sessionStorage.setItem(key, '1');
        return;
      }

      const fmtFecha = (valor: string) => {
        const limpio = String(valor || '').trim();
        if (!limpio) return '-';

        const soloFecha = limpio.includes('T') ? limpio.slice(0, 10) : limpio;
        const [y, m, d] = soloFecha.split('-');
        if (!y || !m || !d) return limpio;

        const fecha = new Date(`${soloFecha}T00:00:00`);
        if (Number.isNaN(fecha.getTime())) return limpio;

        return fecha.toLocaleDateString('es-PE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      };

      const etiquetaFecha = (valor: string, diasFaltan: number) => {
        if (diasFaltan === 0) return 'Hoy';
        if (diasFaltan === 1) return 'Mañana';
        return fmtFecha(valor);
      };

      const etiquetaTiempo = (diasFaltan: number) => {
        if (diasFaltan === 0) return 'Es hoy';
        if (diasFaltan === 1) return 'Falta 1 día';
        return `Faltan ${diasFaltan} días`;
      };

      const html = `
        <div class="app-swal-copy">
          <div class="app-swal-copy__intro">
            Cumpleaños próximos en los siguientes 5 días:
          </div>
          <ul class="app-swal-copy__list">
            ${lista
              .map((r) => {
                const nombre =
                  `${r.nombre} ${r.apellido_paterno || ''} ${r.apellido_materno || ''}`.trim();
                const faltan = Number(r.dias_faltan || 0);
                const fechaBonita = etiquetaFecha(r.proximo_cumple, faltan);
                const labelFaltan = etiquetaTiempo(faltan);
                return `
                  <li class="app-swal-copy__item">
                    <strong>${nombre}</strong><br/>
                    <span class="app-swal-copy__accent">${fechaBonita}</span>
                    <span class="app-swal-copy__muted"> - ${labelFaltan}</span>
                  </li>
                `;
              })
              .join('')}
          </ul>
        </div>
      `;

      await Swal.fire({
        title: 'Cumpleaños próximos',
        html,
        icon: 'info',
        confirmButtonText: 'Entendido',
      });

      sessionStorage.setItem(key, '1');
    } catch (err) {
      console.error('Error obteniendo cumpleaños próximos:', err);
    }
  }

  toggleGrupoUsuarios() {
    this.grupoUsuariosAbierto = !this.grupoUsuariosAbierto;
  }

  toggleGrupoEmpleados() {
    this.grupoEmpleadosAbierto = !this.grupoEmpleadosAbierto;
  }

  toggleGrupoReportes() {
    this.grupoReportesAbierto = !this.grupoReportesAbierto;
  }

  cerrarSesion() {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Su sesión actual será cerrada.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.servicioAutenticacion.cerrarSesion();
        this.enrutador.navigate(['/inicio-sesion']);
      }
    });
  }
}
