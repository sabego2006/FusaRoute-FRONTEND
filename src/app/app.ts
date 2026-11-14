import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ToastComponent } from './components/toast/toast.component';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav.component';
import { SuspensionNoticesComponent } from './components/suspension-notices/suspension-notices.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ToastComponent, BottomNavComponent, SuspensionNoticesComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
