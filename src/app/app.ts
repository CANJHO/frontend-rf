import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoaderGlobalComponent } from "./nucleo/componentes/loader-global/loader-global";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoaderGlobalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent {}


