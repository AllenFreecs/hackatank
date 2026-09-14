import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { AzureSprintItem, AzureSprintService } from '../../core/services/azure-sprint.service';
import { OutlookMessage, OutlookService } from '../../core/services/outlook.service';
import { TeamsCalendarEvent, TeamsCalendarService } from '../../core/services/teams-calendar.service';
import { SharePointFile, SharePointService } from '../../core/services/sharepoint.service';
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
  private readonly sprintService = inject(AzureSprintService);
  private readonly calendarService = inject(TeamsCalendarService);
  private readonly outlookService = inject(OutlookService);
  private readonly sharePointService = inject(SharePointService);
  private readonly destroyRef = inject(DestroyRef);

  weeklyActivity = this.dataService.getWeeklyActivity();
  biPerformance = this.dataService.getBiPerformance();
  teamsCalendar: TeamsCalendarEvent[] = [];
  sprintBoard: Array<{ lane: string; items: AzureSprintItem[] }> = [];
  outlookQueue: OutlookMessage[] = [];
  sharePointFiles: SharePointFile[] = [];
  calendarError = '';
  outlookError = '';
  sprintError = '';
  sharePointError = '';
  sprintIteration = '';
  tasks = this.dataService.getTasksSnapshot();

  constructor() {
    this.loadLiveData();
  }

  get pendingTasks(): number {
    return this.tasks.filter((task) => task.status === 'Pending').length;
  }

  get latestSla(): number {
    return this.biPerformance[this.biPerformance.length - 1]?.sla ?? 0;
  }

  get sprintItems(): number {
    return this.sprintBoard.reduce((total, lane) => total + lane.items.length, 0);
  }

  get approvalQueue(): number {
    return this.outlookQueue.length;
  }

  get sharePointDocCount(): number {
    return this.sharePointFiles.length;
  }

  get displayOutlookQueue(): OutlookMessage[] {
    return this.outlookQueue.filter((mail) => mail.priority !== 'Normal');
  }

  get meetingMinutes(): number {
    return this.teamsCalendar
      .filter((event) => !event.title.toLowerCase().includes('pto'))
      .reduce((total, event) => {
        const mins = Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000);
        return total + (mins <= 480 ? mins : 0);
      }, 0);
  }

  get highPriorityApprovals(): number {
    return this.outlookQueue.filter((mail) => mail.priority === 'High').length;
  }

  get azureSprintItems(): number {
    return this.sprintBoard.reduce((total, lane) => total + lane.items.length, 0);
  }

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

  priorityClass(priority: string): string {
    if (priority === 'High') {
      return 'high';
    }
    if (priority === 'Medium') {
      return 'medium';
    }
    return 'low';
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  formatDate(value?: string): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatFileType(type?: string, name?: string): string {
    const t = (type || '').toLowerCase();
    const n = (name || '').toLowerCase();
    if (t.includes('presentation') || n.endsWith('.pptx') || n.endsWith('.ppt')) return 'PowerPoint';
    if (t.includes('wordprocessing') || n.endsWith('.docx') || n.endsWith('.doc')) return 'Word';
    if (t.includes('spreadsheet') || t.includes('excel') || n.endsWith('.xlsx') || n.endsWith('.xls')) return 'Excel';
    if (t.includes('pdf') || n.endsWith('.pdf')) return 'PDF';
    if (t.includes('image') || n.endsWith('.png') || n.endsWith('.jpg')) return 'Image';
    if (t.includes('folder')) return 'Folder';
    return type && !t.startsWith('application/') ? type : 'Document';
  }

  eventDuration(event: TeamsCalendarEvent): string {
    const minutes = Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000);
    if (minutes >= 1440) {
      const days = Math.round(minutes / 1440);
      return `${days}d`;
    }
    if (minutes >= 60) {
      const hours = (minutes / 60).toFixed(1).replace(/\.0$/, '');
      return `${hours}h`;
    }
    return `${minutes}m`;
  }

  private loadLiveData(): void {
    this.calendarService.getEvents(new Date()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => this.teamsCalendar = result.events,
      error: (error: Error) => this.calendarError = error.message
    });
    this.outlookService.getMessages().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => this.outlookQueue = result.messages,
      error: (error: Error) => this.outlookError = error.message
    });
    this.sprintService.getCurrentSprint(10).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.sprintIteration = result.iteration;
        this.sprintBoard = this.groupSprintItems(result.items);
      },
      error: (error: Error) => this.sprintError = error.message
    });
    this.sharePointService.getFiles('*', 6).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => this.sharePointFiles = result.files,
      error: (error: Error) => this.sharePointError = error.message
    });
  }

  private groupSprintItems(items: AzureSprintItem[]): Array<{ lane: string; items: AzureSprintItem[] }> {
    const lanes = ['Backlog', 'In Progress', 'Review', 'Done'];
    const grouped = lanes.map((lane) => ({ lane, items: [] as AzureSprintItem[] }));
    for (const item of items) {
      const state = item.state.toLowerCase();
      const lane = state.includes('done') || state.includes('closed') || state.includes('resolved')
        ? 'Done'
        : state.includes('review') || state.includes('approved')
          ? 'Review'
          : state.includes('active') || state.includes('progress') || state.includes('committed')
            ? 'In Progress'
            : 'Backlog';
      grouped.find((entry) => entry.lane === lane)?.items.push(item);
    }
    return grouped;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0
    }).format(value);
  }
}
