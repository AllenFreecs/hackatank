import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface AutomationDialogResult {
  name: string;
  trigger: string;
  action: string;
  frequency: string;
  recipient: string;
}

@Component({
  selector: 'app-automation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Create Automation</h2>
    <mat-dialog-content>
      <mat-form-field><mat-label>Name</mat-label><input matInput [(ngModel)]="form.name" /></mat-form-field>
      <mat-form-field><mat-label>Trigger</mat-label><input matInput [(ngModel)]="form.trigger" /></mat-form-field>
      <mat-form-field><mat-label>Action</mat-label><input matInput [(ngModel)]="form.action" /></mat-form-field>
      <mat-form-field><mat-label>Frequency</mat-label><input matInput [(ngModel)]="form.frequency" /></mat-form-field>
      <mat-form-field><mat-label>Recipient</mat-label><input matInput [(ngModel)]="form.recipient" /></mat-form-field>
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
    trigger: 'Every Monday',
    action: 'Generate Operations Report',
    frequency: 'Weekly',
    recipient: 'operations@company.com'
  };
}
