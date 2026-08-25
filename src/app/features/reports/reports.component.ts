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
  loadingId?: number;

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
}
