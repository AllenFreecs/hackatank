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
  biPerformance = this.dataService.getBiPerformance();
  teamsCalendar = this.dataService.getTeamsCalendar();
  sprintBoard = this.dataService.getSprintBoard();
  mcpConnectors = this.dataService.getMcpConnectors();
  outlookQueue = this.dataService.getOutlookQueue();

  readonly maxPipeline = Math.max(...this.biPerformance.map((item) => item.pipeline));
  readonly maxClosedWon = Math.max(...this.biPerformance.map((item) => item.closedWon));

  get biLinePoints(): string {
    const min = Math.min(...this.biPerformance.map((item) => item.closedWon));
    const max = Math.max(...this.biPerformance.map((item) => item.closedWon));
    const spread = Math.max(max - min, 1);
    return this.biPerformance
      .map((item, index) => {
        const x = index * 86;
        const normalized = (item.closedWon - min) / spread;
        const y = 92 - normalized * 58;
        return `${x},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  get chartPoints(): string {
    return this.weeklyActivity
      .map((value, index) => `${index * 70},${80 - (value - 30)}`)
      .join(' ');
  }

  barHeight(value: number, max: number): number {
    return Math.round((value / Math.max(max, 1)) * 100);
  }

  connectorClass(status: string): string {
    if (status === 'Healthy') {
      return 'healthy';
    }
    if (status === 'Warning') {
      return 'warning';
    }
    return 'critical';
  }

  priorityClass(priority: string): string {
    if (priority === 'High') {
      return 'high';
    }
    if (priority === 'Medium') {
      return 'medium';
    }
    return 'low';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0
    }).format(value);
  }
}
