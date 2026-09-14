import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

export interface AzureSprintItem {
  id: number;
  type: string;
  title: string;
  state: string;
  assignedTo: string;
}

export interface AzureSprint {
  iteration: string;
  items: AzureSprintItem[];
}

@Injectable({ providedIn: 'root' })
export class AzureSprintService {
  private readonly endpoint = 'http://127.0.0.1:3001/api/current-sprint';

  constructor(private readonly http: HttpClient) {}

  getCurrentSprint(limit = 50): Observable<AzureSprint> {
    return this.http.get<AzureSprint>(this.endpoint, { params: { limit } }).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => new Error(error.error?.error || 'Unable to load the Azure DevOps sprint.')))
    );
  }
}
