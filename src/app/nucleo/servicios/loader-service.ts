import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LoaderService {

  private peticionesActivas = 0;
  private cargandoSubject = new BehaviorSubject<boolean>(false);
  cargando$: Observable<boolean> = this.cargandoSubject.asObservable();

  // ⬇️ Control de tiempos para que no parpadee
  private mostrarTimeoutId: any = null;
  private ocultarTimeoutId: any = null;
  private visibleDesde: number | null = null;

  // Ajustables si quieres
  private readonly delayMostrarMs = 200;  // no mostrar loader si la petición dura menos que esto
  private readonly minVisibleMs = 500;    // si se muestra, que dure al menos esto

  constructor() {}

  // Se llama cuando una petición HTTP inicia
  mostrar(): void {
    this.peticionesActivas++;

    // Si es la primera petición activa, decidir si mostramos el loader
    if (this.peticionesActivas === 1) {

      // Si había un timer para ocultar, lo cancelamos
      if (this.ocultarTimeoutId) {
        clearTimeout(this.ocultarTimeoutId);
        this.ocultarTimeoutId = null;
      }

      // Si ya está visible, no hacemos nada
      if (this.cargandoSubject.value) {
        return;
      }

      // Programamos mostrarlo solo si la petición dura más de delayMostrarMs
      if (!this.mostrarTimeoutId) {
        this.mostrarTimeoutId = setTimeout(() => {
          // Si todavía hay peticiones activas, mostramos el loader
          if (this.peticionesActivas > 0 && !this.cargandoSubject.value) {
            this.cargandoSubject.next(true);
            this.visibleDesde = Date.now();
          }
          this.mostrarTimeoutId = null;
        }, this.delayMostrarMs);
      }
    }
  }

  // Se llama cuando una petición HTTP termina
  ocultar(): void {
    if (this.peticionesActivas > 0) {
      this.peticionesActivas--;
    }

    // Si aún quedan peticiones, no ocultamos nada
    if (this.peticionesActivas > 0) {
      return;
    }

    // Si ninguna petición quedó activa y todavía no se llegó a mostrar (loader rápido), cancelamos el timer
    if (this.mostrarTimeoutId) {
      clearTimeout(this.mostrarTimeoutId);
      this.mostrarTimeoutId = null;
      this.visibleDesde = null;
      return;
    }

    // Si el loader ni siquiera está visible, nada que ocultar
    if (!this.cargandoSubject.value) {
      return;
    }

    // Respetar tiempo mínimo visible
    const ahora = Date.now();
    const elapsed = this.visibleDesde ? ahora - this.visibleDesde : 0;
    const restante = this.minVisibleMs - elapsed;
    const delayOcultar = restante > 0 ? restante : 0;

    if (this.ocultarTimeoutId) {
      clearTimeout(this.ocultarTimeoutId);
      this.ocultarTimeoutId = null;
    }

    this.ocultarTimeoutId = setTimeout(() => {
      // Solo ocultamos si no entró una nueva petición
      if (this.peticionesActivas === 0) {
        this.cargandoSubject.next(false);
        this.visibleDesde = null;
      }
      this.ocultarTimeoutId = null;
    }, delayOcultar);
  }

  reset(): void {
    this.peticionesActivas = 0;
    this.visibleDesde = null;
    if (this.mostrarTimeoutId) {
      clearTimeout(this.mostrarTimeoutId);
      this.mostrarTimeoutId = null;
    }
    if (this.ocultarTimeoutId) {
      clearTimeout(this.ocultarTimeoutId);
      this.ocultarTimeoutId = null;
    }
    this.cargandoSubject.next(false);
  }
}
