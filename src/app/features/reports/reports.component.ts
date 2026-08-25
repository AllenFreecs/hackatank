import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { DataService } from '../../core/services/data.service';
import { NotificationService } from '../../core/services/notification.service';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [MatCardModule, MatTableModule, MatButtonModule, MatIconModule, LoadingStateComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent {
  private readonly dataService = inject(DataService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  displayedColumns = ['name', 'status', 'lastGenerated', 'owner', 'actions'];
  reports = this.dataService.getReportsSnapshot();
  biPerformance = this.dataService.getBiPerformance();
  mcpConnectors = this.dataService.getMcpConnectors();
  loadingId?: number;

  get totalPipeline(): number {
    return this.biPerformance[this.biPerformance.length - 1]?.pipeline ?? 0;
  }

  get closedWon(): number {
    return this.biPerformance[this.biPerformance.length - 1]?.closedWon ?? 0;
  }

  get avgSla(): number {
    if (!this.biPerformance.length) {
      return 0;
    }
    const total = this.biPerformance.reduce((sum, row) => sum + row.sla, 0);
    return Math.round((total / this.biPerformance.length) * 10) / 10;
  }

  get warningConnectors(): number {
    return this.mcpConnectors.filter((item) => item.status !== 'Healthy').length;
  }

  generate(id: number): void {
    this.loadingId = id;
    const generation = this.dataService.generateReport(id);
    this.reports = this.dataService.getReportsSnapshot();
    generation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadingId = undefined;
      this.reports = this.dataService.getReportsSnapshot();
      this.notificationService.show('Report generated successfully.');
    });
  }

  view(name: string): void {
    this.notificationService.show(`Opening ${name}`);
  }

  download(name: string): void {
    const content = `Report,Status\n${name},Ready`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0
    }).format(value);
  }
}
