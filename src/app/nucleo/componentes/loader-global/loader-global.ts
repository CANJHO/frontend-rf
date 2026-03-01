import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../servicios/loader-service';

@Component({
  selector: 'app-loader-global',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loader-global.html',
  styleUrls: ['./loader-global.scss'],
})
export class LoaderGlobalComponent {

  cargando$; // declaramos primero

  constructor(private loaderService: LoaderService) {
    this.cargando$ = this.loaderService.cargando$; // y asignamos aquí
  }
}

