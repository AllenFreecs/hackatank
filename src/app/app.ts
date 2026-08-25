import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DemoService } from './core/services/demo.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'AI Assistant', icon: 'smart_toy', route: '/assistant' },
    { label: 'Reports', icon: 'description', route: '/reports' },
    { label: 'Knowledge', icon: 'library_books', route: '/knowledge' },
    { label: 'Automations', icon: 'auto_awesome', route: '/automations' },
    { label: 'Activity', icon: 'history', route: '/activity' },
    { label: 'Settings', icon: 'settings', route: '/settings' }
  ];

  constructor(readonly demoService: DemoService) {}
}
