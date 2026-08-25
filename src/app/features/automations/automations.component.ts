import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DataService } from '../../core/services/data.service';
import { NotificationService } from '../../core/services/notification.service';
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
  private readonly dialog = inject(MatDialog);
  private readonly notificationService = inject(NotificationService);

  automations = this.dataService.getAutomationsSnapshot();

  createAutomation(): void {
    this.dialog.open(AutomationDialogComponent).afterClosed().subscribe((result?: AutomationDialogResult) => {
      if (!result) {
        return;
      }
      this.dataService.addAutomation(result);
      this.refresh();
      this.notificationService.show('Automation created.');
    });
  }

  runNow(name: string): void {
    this.notificationService.show(`${name} executed.`);
  }

  disable(id: number): void {
    this.dataService.setAutomationStatus(id, 'Disabled');
    this.refresh();
  }

  private refresh(): void {
    this.automations = this.dataService.getAutomationsSnapshot();
  }
}
