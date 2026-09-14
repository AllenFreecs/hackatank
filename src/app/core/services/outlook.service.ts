import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

export interface OutlookMessage {
  id: string;
  subject: string;
  sender: string;
  priority: 'High' | 'Normal' | 'Low';
  received: string;
  isRead: boolean;
  webUrl: string;
}

@Injectable({ providedIn: 'root' })
export class OutlookService {
  private readonly endpoint = 'http://127.0.0.1:3001/api/outlook-messages';

  constructor(private readonly http: HttpClient) {}

  getMessages(limit = 25): Observable<{ messages: OutlookMessage[]; nextLink: string | null }> {
    return this.http.get<{ messages: OutlookMessage[]; nextLink: string | null }>(this.endpoint, { params: { limit } }).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => new Error(error.error?.error || 'Unable to load the Outlook mailbox.')))
    );
  }
}
