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
      <mat-card class="wtw-panel">
        <div class="activity-list">
          @for (item of activities; track item; let i = $index) {
            <article class="activity-item">
              <span class="activity-dot" aria-hidden="true"></span>
              <div>
                <p class="activity-text">{{ item }}</p>
                <p class="activity-time">{{ i + 1 }}h ago</p>
              </div>
            </article>
          }
        </div>
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

      .activity-list {
        display: grid;
        gap: 0.58rem;
      }

      .activity-item {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.62rem;
        padding: 0.6rem 0.72rem;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--app-border) 72%, transparent);
        background: color-mix(in srgb, var(--app-accent-soft) 8%, #ffffff 92%);
      }

      .activity-dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        background: var(--app-accent);
        margin-top: 0.46rem;
      }

      .activity-text {
        margin: 0;
        color: var(--app-text);
        font-weight: 500;
        line-height: 1.4;
      }

      .activity-time {
        margin: 0.12rem 0 0;
        font-size: 0.76rem;
        color: var(--app-muted);
      }
    `
  ]
})
export class ActivityComponent {
  private readonly dataService = inject(DataService);
  activities = this.dataService.getActivitiesSnapshot();
}
