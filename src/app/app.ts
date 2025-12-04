import { Component, signal, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly isDarkMode = signal<boolean>(this.loadDarkMode());

  constructor() {
    // Apply initial dark mode
    document.body.classList.toggle('dark-theme', this.isDarkMode());
    
    // Listen for dark mode changes
    effect(() => {
      const darkMode = this.isDarkMode();
      localStorage.setItem('darkMode', darkMode.toString());
      document.body.classList.toggle('dark-theme', darkMode);
    });
    
    // Listen for external dark mode changes (from settings)
    window.addEventListener('darkModeChanged', () => {
      const saved = localStorage.getItem('darkMode');
      this.isDarkMode.set(saved === 'true');
    });
  }

  private loadDarkMode(): boolean {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  }
}
