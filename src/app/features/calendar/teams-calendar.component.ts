import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NotificationService } from '../../core/services/notification.service';
import { CreateTeamsCalendarEvent, TeamsCalendarEvent, TeamsCalendarService } from '../../core/services/teams-calendar.service';

@Component({
  selector: 'app-teams-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSlideToggleModule],
  templateUrl: './teams-calendar.component.html',
  styleUrl: './teams-calendar.component.scss'
})
export class TeamsCalendarComponent {
  private readonly calendarService = inject(TeamsCalendarService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  selectedDay = new Date();
  events: TeamsCalendarEvent[] = [];
  isLoading = false;
  errorMessage = '';
  showComposer = false;
  form: CreateTeamsCalendarEvent = this.newForm();
  attendeeText = '';

  constructor() {
    this.loadEvents();
  }

  get dayLabel(): string {
    return this.selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  get totalMinutes(): number {
    return this.events.reduce((total, event) => total + (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000, 0);
  }

  previousDay(): void {
    this.shiftDay(-1);
  }

  nextDay(): void {
    this.shiftDay(1);
  }

  goToToday(): void {
    this.selectedDay = new Date();
    this.loadEvents();
  }

  openComposer(): void {
    this.form = this.newForm();
    this.attendeeText = '';
    this.showComposer = true;
  }

  cancelComposer(): void {
    this.showComposer = false;
  }

  createEvent(): void {
    if (!this.form.title.trim() || !this.form.start || !this.form.end) {
      return;
    }

    this.calendarService.createEvent({
      ...this.form,
      title: this.form.title.trim(),
      attendees: this.attendeeText.split(',').map((address) => address.trim()).filter(Boolean)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (event) => {
        this.showComposer = false;
        this.notificationService.show(`Teams calendar event created: ${event.title}`);
        this.loadEvents();
      },
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  private shiftDay(days: number): void {
    const nextDay = new Date(this.selectedDay);
    nextDay.setDate(nextDay.getDate() + days);
    this.selectedDay = nextDay;
    this.loadEvents();
  }

  loadEvents(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.calendarService.getEvents(this.selectedDay).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.events = result.events;
        this.isLoading = false;
      },
      error: (error: Error) => {
        this.events = [];
        this.errorMessage = error.message;
        this.isLoading = false;
      }
    });
  }

  private newForm(): CreateTeamsCalendarEvent {
    const start = new Date(this.selectedDay);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(30);
    return {
      title: '',
      start: this.toLocalInput(start),
      end: this.toLocalInput(end),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: '',
      isOnlineMeeting: true,
      attendees: []
    };
  }

  private toLocalInput(value: Date): string {
    const pad = (part: number) => `${part}`.padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
}
