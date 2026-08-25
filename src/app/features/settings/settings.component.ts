import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [MatCardModule],
  template: '<h1>Settings</h1><mat-card><p>Configure assistant preferences, notifications, and demo defaults.</p></mat-card>',
  styles: ['h1{color:#0f2a5f;} mat-card{border-radius:16px;}']
})
export class SettingsComponent {}
