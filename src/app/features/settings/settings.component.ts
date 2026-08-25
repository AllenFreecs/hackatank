import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="settings-page">
      <h1>Settings</h1>
      <mat-card class="wtw-panel">
        <p>Configure assistant preferences, notifications, and demo defaults.</p>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .settings-page {
        display: grid;
        gap: 1rem;
      }

      h1 {
        margin: 0;
        color: var(--app-heading);
        font-family: 'Playfair Display', 'Times New Roman', serif;
        letter-spacing: 0.01em;
      }

      mat-card {
        border-radius: 18px;
      }

      p {
        color: var(--app-muted);
      }
    `
  ]
})
export class SettingsComponent {}
