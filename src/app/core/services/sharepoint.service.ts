import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

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
      catchError((error: HttpErrorResponse) =>
        throwError(() => new Error(error.error?.error || 'Unable to load SharePoint files.'))
      )
    );
  }
}
