import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

export interface AutomationDialogResult {
  name: string;
  trigger: string;
  action: string;
  frequency: string;
  recipient: string;
  automationType?: 'File Creation' | 'Email Creation';
  fileType?: 'excel' | 'word' | 'pdf';
  aiQuery?: string;
  status?: 'Enabled' | 'Disabled';
}

@Component({
  selector: 'app-automation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Create Automation</h2>
    <mat-dialog-content>
      <mat-form-field><mat-label>Automation name</mat-label><input matInput [(ngModel)]="form.name" /></mat-form-field>
      <mat-form-field><mat-label>Automation Type</mat-label>
        <mat-select [(ngModel)]="form.automationType">
          <mat-option value="File Creation">File Creation</mat-option>
          <mat-option value="Email Creation">Email Creation</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field><mat-label>Frequency</mat-label><input matInput [(ngModel)]="form.frequency" placeholder="every 5 minutes, daily, every 2 hours" /></mat-form-field>
      <mat-form-field><mat-label>File Type</mat-label>
        <mat-select [(ngModel)]="form.fileType" [disabled]="form.automationType !== 'File Creation'">
          <mat-option value="excel">excel</mat-option>
          <mat-option value="word">word</mat-option>
          <mat-option value="pdf">pdf</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field><mat-label>Trigger</mat-label><input matInput [(ngModel)]="form.trigger" /></mat-form-field>
      <mat-form-field><mat-label>Action</mat-label><input matInput [(ngModel)]="form.action" /></mat-form-field>
      <mat-form-field><mat-label>Recipient</mat-label><input matInput [(ngModel)]="form.recipient" /></mat-form-field>
      <mat-form-field><mat-label>AI Query</mat-label><textarea matInput rows="3" [(ngModel)]="form.aiQuery" placeholder="Original prompt to rerun later"></textarea></mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="dialogRef.close(form)">Create</button>
    </mat-dialog-actions>
  `,
  styles: ['mat-form-field { display:block; }']
})
export class AutomationDialogComponent {
  dialogRef = inject(MatDialogRef<AutomationDialogComponent>);
  form = inject(MAT_DIALOG_DATA, { optional: true }) as AutomationDialogResult ?? {
    name: '',
    trigger: 'Scheduled report generation',
    action: 'Create report package',
    frequency: 'every 5 minutes',
    recipient: 'operations@company.com',
    automationType: 'File Creation',
    fileType: 'pdf',
    aiQuery: '',
    status: 'Enabled'
  };
}
