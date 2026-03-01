import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ServicioAutenticacion } from '../../nucleo/servicios/servicio-autenticacion';
import Swal from 'sweetalert2';
import { ServicioEmpleados, CumpleanosProximoRow } from '../../nucleo/servicios/servicio-empleados';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-panel-principal',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './panel-principal.html',
  styleUrls: ['./panel-principal.scss'],
})
export class PanelPrincipalComponent implements OnInit {
  usuario$;

  grupoUsuariosAbierto = false;
  grupoReportesAbierto = false;
  grupoEmpleadosAbierto = false;

  // dropdown perfil
  userMenuOpen = false;

  // ✅ drawer móvil
  sidebarOpen = false;

  constructor(
    private servicioAutenticacion: ServicioAutenticacion,
    private servicioEmpleados: ServicioEmpleados,
    private enrutador: Router,
  ) {
    this.usuario$ = this.servicioAutenticacion.usuarioActual$;
  }

  async ngOnInit(): Promise<void> {
    const usuario = await firstValueFrom(
      this.usuario$.pipe(
        filter((u: any) => !!u?.sub),
        take(1),
      ),
    );

    this.mostrarModalCumpleanosSiCorresponde(usuario.sub);
  }

  /* ==========================
     ✅ Drawer móvil
  ========================== */

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;

    // si abres el sidebar, cierra el dropdown de usuario
    if (this.sidebarOpen && this.userMenuOpen) this.userMenuOpen = false;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  closeSidebarOnMobile() {
    // cierra solo en móvil (mejor UX)
    if (window.innerWidth <= 768) this.sidebarOpen = false;
  }

  /* ==========================
     Dropdown perfil
  ========================== */

  toggleUserMenu(event: MouseEvent) {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;

    // si abres el dropdown, cierra el sidebar
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
    // si pasas a desktop, asegúrate de cerrar el drawer para evitar estados raros
    if (window.innerWidth > 768 && this.sidebarOpen) this.sidebarOpen = false;
  }

  getIniciales(nombre: string, apellido: string) {
    const n = (nombre || '').trim();
    const a = (apellido || '').trim();
    const i1 = n ? n[0].toUpperCase() : '';
    const i2 = a ? a[0].toUpperCase() : '';
    return `${i1}${i2}` || 'U';
  }

  /* ==========================
     Cumpleaños
  ========================== */

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

      const fmt = (iso: string) => {
        const [y, m, d] = (iso || '').split('-');
        return (y && m && d) ? `${d}/${m}/${y}` : iso;
      };

      const html = `
        <div style="text-align:left; line-height:1.4;">
          <div style="margin-bottom:8px; color:#cfcfcf;">
            Cumpleaños próximos (en los siguientes 5 días):
          </div>
          <ul style="padding-left:18px; margin:0;">
            ${lista.map((r) => {
              const nombre = `${r.nombre} ${r.apellido_paterno || ''} ${r.apellido_materno || ''}`.trim();
              const faltan = Number(r.dias_faltan || 0);
              const labelFaltan = (faltan === 0) ? 'HOY' : `Faltan ${faltan} día(s)`;
              return `
                <li style="margin:6px 0;">
                  <strong>${nombre}</strong><br/>
                  <span style="color:#d4af37;">${fmt(r.proximo_cumple)}</span>
                  <span style="color:#9a9a9a;"> — ${labelFaltan}</span>
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      `;

      await Swal.fire({
        title: 'Cumpleaños próximos',
        html,
        icon: 'info',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#d4af37',
        background: '#111',
        color: '#f5f5f5',
      });

      sessionStorage.setItem(key, '1');
    } catch (err) {
      console.error('Error obteniendo cumpleaños próximos:', err);
    }
  }

  /* ==========================
     Toggles grupos
  ========================== */

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
      confirmButtonColor: '#d4af37',
      cancelButtonColor: '#444',
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar',
      background: '#111',
      color: '#f5f5f5',
    }).then((result) => {
      if (result.isConfirmed) {
        this.servicioAutenticacion.cerrarSesion();
        this.enrutador.navigate(['/inicio-sesion']);
      }
    });
  }
}