import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ToastComponent } from './components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // El título ya no lleva -TEMP
  protected readonly title = signal('FusaRoute');
}
