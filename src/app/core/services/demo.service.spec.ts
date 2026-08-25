import { TestBed } from '@angular/core/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { DemoService } from './demo.service';
import { DataService } from './data.service';

describe('DemoService', () => {
  let demoService: DemoService;
  let dataService: DataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MatSnackBarModule] });
    demoService = TestBed.inject(DemoService);
    dataService = TestBed.inject(DataService);
  });

  it('loads hr onboarding scenario with extra hr task', () => {
    demoService.loadScenario('HR Onboarding');
    const task = dataService.getTasksSnapshot().find((entry) => entry.id === 99);
    expect(task?.department).toBe('HR');
    expect(task?.status).toBe('Pending');
  });

  it('resets demo data', () => {
    demoService.resetDemo();
    expect(dataService.getReportsSnapshot().length).toBe(4);
  });
});
