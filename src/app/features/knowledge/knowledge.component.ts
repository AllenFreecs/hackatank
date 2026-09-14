import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { DataService } from '../../core/services/data.service';
import { NotificationService } from '../../core/services/notification.service';
import { SharePointFile, SharePointService } from '../../core/services/sharepoint.service';

@Component({
  selector: 'app-knowledge',
  standalone: true,
  imports: [MatCardModule, MatTableModule, MatFormFieldModule, MatInputModule, MatButtonModule, FormsModule],
  templateUrl: './knowledge.component.html',
  styleUrl: './knowledge.component.scss'
})
export class KnowledgeComponent implements OnInit {
  private readonly sharePointService = inject(SharePointService);
  private readonly dataService = inject(DataService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  displayedColumns = ['name', 'siteName', 'type', 'modifiedDate', 'open'];
  documents: SharePointFile[] = [];
  query = '';
  answer = '';
  source = '';
  error = '';

  ngOnInit(): void {
    this.searchSharePoint('*');
  }

  ask(): void {
    const q = this.query.trim() || '*';
    if (q.toLowerCase().includes('purchase request')) {
      const policy = this.dataService.getPurchaseRequestPolicy();
      this.answer = policy.answer;
      this.source = policy.source;
    } else {
      this.answer = '';
      this.source = '';
    }
    this.searchSharePoint(q);
  }

  private searchSharePoint(query: string): void {
    this.sharePointService.getFiles(query, 25).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.documents = result.files;
        this.error = '';
        if (query !== '*' && result.files.length && !this.answer) {
          const top = result.files[0];
          this.answer = `Found ${result.files.length} SharePoint result${result.files.length === 1 ? '' : 's'} matching "${query}".`;
          this.source = `${top.name} (${top.siteName})`;
        }
      },
      error: (err: Error) => {
        this.error = err.message;
        this.documents = [];
      }
    });
  }

  openDocument(doc: SharePointFile): void {
    if (doc.url) {
      window.open(doc.url, '_blank');
    } else {
      this.notificationService.show(`Opened ${doc.name}`);
    }
  }
}
