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
    const hrTasks = dataService.getPendingByDepartment().find((entry) => entry.department === 'HR');
    expect(hrTasks?.pending).toBe(42);
  });

  it('resets demo data', () => {
    demoService.resetDemo();
    expect(dataService.getReportsSnapshot().length).toBe(4);
  });
});
