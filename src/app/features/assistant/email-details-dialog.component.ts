import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface EmailDetailsDialogData {
  recipient: string;
  subject: string;
  body: string;
}

export interface EmailDetailsDialogResult {
  recipient: string;
  subject: string;
}

@Component({
  selector: 'app-email-details-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Email details</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline">
        <mat-label>Recipient</mat-label>
        <input matInput type="email" [(ngModel)]="form.recipient" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Title</mat-label>
        <input matInput [(ngModel)]="form.subject" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Message preview</mat-label>
        <textarea matInput rows="8" [value]="form.body" readonly></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!form.recipient.trim() || !form.subject.trim()" (click)="send()">Send</button>
    </mat-dialog-actions>
  `,
  styles: ['mat-form-field { display: block; width: 100%; } textarea { resize: vertical; }']
})
export class EmailDetailsDialogComponent {
  readonly dialogRef = inject(MatDialogRef<EmailDetailsDialogComponent>);
  readonly form = { ...inject<EmailDetailsDialogData>(MAT_DIALOG_DATA) };

  send(): void {
    this.dialogRef.close({
      recipient: this.form.recipient.trim(),
      subject: this.form.subject.trim()
    } satisfies EmailDetailsDialogResult);
  }
}
