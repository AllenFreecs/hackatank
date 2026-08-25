import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-knowledge',
  standalone: true,
  imports: [MatCardModule, MatTableModule, MatFormFieldModule, MatInputModule, MatButtonModule, FormsModule],
  templateUrl: './knowledge.component.html',
  styleUrl: './knowledge.component.scss'
})
export class KnowledgeComponent {
  private readonly dataService = inject(DataService);

  displayedColumns = ['name', 'category', 'updatedDate', 'relevance', 'open'];
  documents = this.dataService.getDocumentsSnapshot();
  query = '';
  answer = '';
  source = '';

  ask(): void {
    if (!this.query.trim()) {
      return;
    }
    const results = this.dataService.searchDocuments(this.query);
    if (this.query.toLowerCase().includes('purchase request')) {
      this.answer =
        'Purchase requests below ₱50,000 require department approval. Requests above ₱50,000 require Finance review.';
      this.source = 'Purchase Request SOP.pdf';
      return;
    }
    const top = results[0];
    this.answer = top ? top.summary : 'No matching document found.';
    this.source = top?.name ?? '-';
  }
}
