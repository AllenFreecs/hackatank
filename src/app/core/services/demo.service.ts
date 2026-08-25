import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class DemoService {
  readonly scenarios = [
    'Reporting Crisis',
    'HR Onboarding',
    'Meeting Follow-up',
    'Knowledge Search',
    'Automation Opportunity'
  ];

  constructor(
    private readonly dataService: DataService,
    private readonly notificationService: NotificationService
  ) {}

  resetDemo(): void {
    this.dataService.resetDemo();
    this.notificationService.show('Demo reset complete.');
  }

  loadScenario(name: string): void {
    this.dataService.loadScenario(name);
    this.notificationService.show(`${name} scenario loaded.`);
  }
}
