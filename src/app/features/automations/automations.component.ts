import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DataService } from '../../core/services/data.service';
import { NotificationService } from '../../core/services/notification.service';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { AutomationDialogComponent, AutomationDialogResult } from './automation-dialog.component';

@Component({
  selector: 'app-automations',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatDialogModule],
  templateUrl: './automations.component.html',
  styleUrl: './automations.component.scss'
})
export class AutomationsComponent {
  private readonly dataService = inject(DataService);
  private readonly assistantService = inject(AiAssistantService);
  private readonly dialog = inject(MatDialog);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  automations = this.dataService.getAutomationsSnapshot();

  createAutomation(): void {
    this.dialog
      .open(AutomationDialogComponent)
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result?: AutomationDialogResult) => {
        if (!result) {
          return;
        }
        this.dataService.addAutomation({
          ...result,
          status: result.status ?? 'Enabled'
        });
        this.refresh();
        this.notificationService.show('Automation created.');
      });
  }

  editAutomation(id: number): void {
    const existing = this.automations.find((item) => item.id === id);
    if (!existing) {
      return;
    }

    this.dialog
      .open(AutomationDialogComponent, {
        data: {
          name: existing.name,
          trigger: existing.trigger,
          action: existing.action,
          frequency: existing.frequency,
          recipient: existing.recipient
        }
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result?: AutomationDialogResult) => {
        if (!result) {
          return;
        }
        this.dataService.updateAutomation(id, {
          ...result,
          status: result.status ?? 'Enabled'
        });
        this.refresh();
        this.notificationService.show('Automation updated.');
      });
  }

  runNow(item: { id: number; name: string; aiQuery?: string }): void {
    if (!item.aiQuery) {
      this.notificationService.show(`No saved AI query found for ${item.name}.`);
      return;
    }

    this.assistantService
      .respond(item.aiQuery)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((reply) => {
        const automation = this.automations.find((entry) => entry.id === item.id);
        if (automation?.automationType === 'Email Creation') {
          const output = this.dataService.simulateSendEmail(
            reply.emailDraft?.subject ?? automation.name,
            reply.emailDraft?.body ?? reply.content,
            automation.recipient
          );
          this.notificationService.show(`Email file created: ${output}`);
          return;
        }

        this.notificationService.show(`${item.name} executed. ${reply.content.slice(0, 80)}${reply.content.length > 80 ? '...' : ''}`);
      });
  }

  openExportFolder(): void {
    this.dataService.openExportFolder();
    this.notificationService.show('Opening export folder.');
  }

  disable(id: number): void {
    const current = this.automations.find((item) => item.id === id);
    this.dataService.setAutomationStatus(id, current?.status === 'Disabled' ? 'Enabled' : 'Disabled');
    this.refresh();
  }

  delete(id: number): void {
    this.dataService.deleteAutomation(id);
    this.refresh();
    this.notificationService.show('Automation deleted.');
  }

  isEnabled(item: { status?: string }): boolean {
    return item.status === 'Enabled' || item.status === 'Active';
  }

  private refresh(): void {
    this.automations = this.dataService.getAutomationsSnapshot();
  }
}
