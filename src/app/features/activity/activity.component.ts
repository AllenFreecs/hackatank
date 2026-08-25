import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="activity-page">
      <h1>Activity Feed</h1>
      <mat-card>
        <ul>
          @for (item of activities; track item) {
            <li>{{ item }}</li>
          }
        </ul>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .activity-page {
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

      ul {
        margin: 0;
        padding-left: 1rem;
        color: var(--app-muted);
      }

      li {
        margin: 0.26rem 0;
      }
    `
  ]
})
export class ActivityComponent {
  private readonly dataService = inject(DataService);
  activities = this.dataService.getActivitiesSnapshot();
}
