import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, RouterLink, KpiCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly dataService = inject(DataService);

  kpis = this.dataService.getKpis();
  weeklyActivity = this.dataService.getWeeklyActivity();
  recentActivity = this.dataService.getActivitiesSnapshot();

  get chartPoints(): string {
    return this.weeklyActivity
      .map((value, index) => `${index * 70},${80 - (value - 30)}`)
      .join(' ');
  }
}
