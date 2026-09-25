import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import documentsSeed from '../../../assets/data/documents.json';

export interface SharePointFile {
  id: string | number;
  name: string;
  url: string;
  type: string;
  category?: string;
  modifiedDate?: string;
  siteName: string;
  summary?: string;
}

export interface SharePointSearchResult {
  query: string;
  files: SharePointFile[];
  message: string;
}

@Injectable({ providedIn: 'root' })
export class SharePointService {
  private readonly endpoint = 'http://127.0.0.1:3001/api/sharepoint-files';
  private readonly http = inject(HttpClient);

  getFiles(query = '*', limit = 10): Observable<SharePointSearchResult> {
    return this.http.get<SharePointSearchResult>(this.endpoint, { params: { query, limit } }).pipe(
      catchError(() => of(this.searchSeedDocuments(query, limit)))
    );
  }

  private searchSeedDocuments(query: string, limit: number): SharePointSearchResult {
    const normalizedQuery = query.trim().toLowerCase();
    const files = (documentsSeed as Array<{
      id: number;
      name: string;
      category: string;
      updatedDate: string;
      relevance: number;
      summary: string;
      content: string;
    }>)
      .filter((document) => normalizedQuery === '*' || [document.name, document.category, document.summary, document.content]
        .some((field) => field.toLowerCase().includes(normalizedQuery)))
      .sort((first, second) => second.relevance - first.relevance)
      .slice(0, Number.isInteger(limit) && limit > 0 ? limit : 10)
      .map((document) => ({
        id: document.id,
        name: document.name,
        url: '',
        type: document.name.split('.').pop()?.toUpperCase() || 'Document',
        modifiedDate: document.updatedDate,
        siteName: 'Demo Knowledge Hub',
        summary: document.summary
      }));

    return {
      query,
      files,
      message: `Found ${files.length} demo SharePoint result${files.length === 1 ? '' : 's'}.`
    };
  }
}
