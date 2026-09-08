import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

export interface ExportDetailsDialogData {
  filename: string;
}

export interface ExportDetailsDialogResult {
  filename: string;
  fileType: 'excel' | 'word' | 'pdf';
}

@Component({
  selector: 'app-export-details-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Export tagged response</h2>
    <mat-dialog-content>
      <p>Choose a filename and file type for the tagged assistant response.</p>
      <mat-form-field appearance="outline">
        <mat-label>Filename</mat-label>
        <input matInput [(ngModel)]="form.filename" autocomplete="off" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>File type</mat-label>
        <mat-select [(ngModel)]="form.fileType">
          <mat-option value="excel">Excel (.xlsx)</mat-option>
          <mat-option value="word">Word (.docx)</mat-option>
          <mat-option value="pdf">PDF (.pdf)</mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!form.filename.trim()" (click)="dialogRef.close(form)">Export</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-form-field { display: block; }
      mat-dialog-content { min-width: min(420px, calc(100vw - 64px)); }
      p { color: var(--app-muted); margin: 0 0 1rem; }
    `
  ]
})
export class ExportDetailsDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ExportDetailsDialogComponent>);
  readonly form: ExportDetailsDialogResult = {
    filename: (inject(MAT_DIALOG_DATA, { optional: true }) as ExportDetailsDialogData | null)?.filename ?? 'assistant-response',
    fileType: 'pdf'
  };
}
