import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [MatCardModule],
  template: '<h1>Activity</h1><mat-card><ul>@for (item of activities; track item) {<li>{{ item }}</li>}</ul></mat-card>',
  styles: ['h1 { color:#0f2a5f; } mat-card{border-radius:16px;} ul{margin:0; padding-left:1rem;}']
})
export class ActivityComponent {
  private readonly dataService = inject(DataService);
  activities = this.dataService.getActivitiesSnapshot();
}
