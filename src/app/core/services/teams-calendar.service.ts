import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

export interface TeamsCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  timeZone?: string;
  location: string;
  organizer: string;
  isOnlineMeeting: boolean;
  joinUrl: string;
}

export interface CreateTeamsCalendarEvent {
  title: string;
  start: string;
  end: string;
  timeZone?: string;
  location?: string;
  isOnlineMeeting?: boolean;
  attendees?: string[];
}

@Injectable({ providedIn: 'root' })
export class TeamsCalendarService {
  private readonly endpoint = 'http://127.0.0.1:3001/api/teams-calendar';

  constructor(private readonly http: HttpClient) {}

  getEvents(day: Date): Observable<{ events: TeamsCalendarEvent[]; nextLink: string | null }> {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const params = {
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString()
    };

    return this.http.get<{ events: TeamsCalendarEvent[]; nextLink: string | null }>(this.endpoint, { params }).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => new Error(error.error?.error || 'Unable to load the Microsoft Teams calendar.')))
    );
  }

  createEvent(event: CreateTeamsCalendarEvent): Observable<TeamsCalendarEvent> {
    return this.http.post<TeamsCalendarEvent>(this.endpoint, event).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => new Error(error.error?.error || 'Unable to create the calendar event.')))
    );
  }
}
