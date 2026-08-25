import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, map, of } from 'rxjs';
import { Automation } from '../../models/automation.model';
import { DocumentItem } from '../../models/document.model';
import { Employee } from '../../models/employee.model';
import { Report } from '../../models/report.model';
import { Task } from '../../models/task.model';

import automationsSeed from '../../../assets/data/automations.seed.json';
import departmentsSeed from '../../../assets/data/departments.json';
import documentsSeed from '../../../assets/data/documents.json';
import employeesSeed from '../../../assets/data/employees.json';
import meetingsSeed from '../../../assets/data/meetings.json';
import reportsSeed from '../../../assets/data/reports.json';
import salesSeed from '../../../assets/data/sales.json';
import tasksSeed from '../../../assets/data/tasks.json';

interface MeetingRecord {
  id: number;
  title: string;
  summary: string;
  decisions: string[];
  actionItems: Array<{ owner: string; action: string; due: string }>;
}

interface SalesRecord {
  month: string;
  amount: number;
}

interface DepartmentRecord {
  name: string;
  head: string;
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly seed = {
    tasks: tasksSeed as Task[],
    reports: reportsSeed as Report[],
    documents: documentsSeed as DocumentItem[],
    employees: employeesSeed as Employee[],
    meetings: meetingsSeed as MeetingRecord[],
    sales: salesSeed as SalesRecord[],
    departments: departmentsSeed as DepartmentRecord[],
    automations: automationsSeed as Automation[],
    activities: [
      'Weekly operations report generated',
      '3 follow-up tasks created',
      'Finance policy summarized',
      'HR onboarding document accessed'
    ]
  };

  private readonly tasksSubject = new BehaviorSubject<Task[]>([]);
  private readonly reportsSubject = new BehaviorSubject<Report[]>([]);
  private readonly documentsSubject = new BehaviorSubject<DocumentItem[]>([]);
  private readonly employeesSubject = new BehaviorSubject<Employee[]>([]);
  private readonly meetingsSubject = new BehaviorSubject<MeetingRecord[]>([]);
  private readonly salesSubject = new BehaviorSubject<SalesRecord[]>([]);
  private readonly departmentsSubject = new BehaviorSubject<DepartmentRecord[]>([]);
  private readonly automationsSubject = new BehaviorSubject<Automation[]>([]);
  private readonly activitySubject = new BehaviorSubject<string[]>([]);

  tasks$ = this.tasksSubject.asObservable();
  reports$ = this.reportsSubject.asObservable();
  documents$ = this.documentsSubject.asObservable();
  automations$ = this.automationsSubject.asObservable();
  activity$ = this.activitySubject.asObservable();

  constructor() {
    this.resetDemo();
  }

  resetDemo(): void {
    this.tasksSubject.next(this.clone(this.seed.tasks));
    this.reportsSubject.next(this.clone(this.seed.reports));
    this.documentsSubject.next(this.clone(this.seed.documents));
    this.employeesSubject.next(this.clone(this.seed.employees));
    this.meetingsSubject.next(this.clone(this.seed.meetings));
    this.salesSubject.next(this.clone(this.seed.sales));
    this.departmentsSubject.next(this.clone(this.seed.departments));
    this.automationsSubject.next(this.clone(this.seed.automations));
    this.activitySubject.next(this.clone(this.seed.activities));
  }

  loadScenario(name: string): void {
    this.resetDemo();
    if (name === 'Reporting Crisis') {
      const reports = this.reportsSubject.value.map((report) =>
        report.name.includes('Weekly') ? { ...report, status: 'Pending' as const } : report
      );
      this.reportsSubject.next(reports);
      this.addActivity('Demo scenario loaded: Reporting Crisis');
      return;
    }

    if (name === 'HR Onboarding') {
      const extraTasks: Task[] = [
        {
          id: 99,
          department: 'HR',
          title: 'Validate onboarding packets',
          status: 'Pending',
          owner: 'Maria Santos',
          dueDate: '2026-08-31',
          category: 'Onboarding'
        }
      ];
      this.tasksSubject.next([...this.tasksSubject.value, ...extraTasks]);
      this.addActivity('Demo scenario loaded: HR Onboarding');
      return;
    }

    this.addActivity(`Demo scenario loaded: ${name}`);
  }

  getKpis(): { pendingTasks: number; reportsGenerated: number; followUps: number; automationOpportunities: number } {
    return {
      pendingTasks: 91,
      reportsGenerated: 38,
      followUps: 14,
      automationOpportunities: 27
    };
  }

  getPendingByDepartment(): Array<{ department: string; pending: number }> {
    const ordered = [
      { department: 'HR', pending: 42 },
      { department: 'Finance', pending: 31 },
      { department: 'Operations', pending: 18 }
    ];
    return ordered;
  }

  getWeeklyActivity(): number[] {
    return [35, 42, 39, 48, 56, 52, 61];
  }

  getSales(): SalesRecord[] {
    return this.clone(this.salesSubject.value);
  }

  getMeetingSummary(): MeetingRecord {
    const firstMeeting = this.meetingsSubject.value[0];
    if (!firstMeeting) {
      return {
        id: 0,
        title: 'No meeting',
        summary: 'No meeting data available.',
        decisions: [],
        actionItems: []
      };
    }
    return this.clone(firstMeeting);
  }

  generateReport(reportId: number): Observable<Report> {
    const report = this.reportsSubject.value.find((entry) => entry.id === reportId);
    if (!report) {
      return of({ id: 0, name: 'Unknown', owner: 'System', status: 'Pending', lastGenerated: new Date().toISOString().slice(0, 10) });
    }

    this.reportsSubject.next(
      this.reportsSubject.value.map((entry) =>
        entry.id === reportId ? { ...entry, status: 'Generating' } : entry
      )
    );

    return of(report).pipe(
      delay(1200),
      map(() => {
        const updated: Report = {
          ...report,
          status: 'Ready',
          lastGenerated: new Date().toISOString().slice(0, 10)
        };
        this.reportsSubject.next(
          this.reportsSubject.value.map((entry) => (entry.id === reportId ? updated : entry))
        );
        this.addActivity(`${updated.name} generated successfully`);
        return updated;
      })
    );
  }

  addAutomation(input: Omit<Automation, 'id' | 'status'>): void {
    const nextId = Math.max(...this.automationsSubject.value.map((item) => item.id), 0) + 1;
    const automation: Automation = { ...input, id: nextId, status: 'Draft' };
    this.automationsSubject.next([...this.automationsSubject.value, automation]);
    this.addActivity(`Automation created: ${automation.name}`);
  }

  setAutomationStatus(id: number, status: Automation['status']): void {
    this.automationsSubject.next(
      this.automationsSubject.value.map((automation) =>
        automation.id === id ? { ...automation, status } : automation
      )
    );
  }

  updateAutomation(id: number, updates: Omit<Automation, 'id' | 'status'>): void {
    this.automationsSubject.next(
      this.automationsSubject.value.map((automation) =>
        automation.id === id ? { ...automation, ...updates } : automation
      )
    );
    this.addActivity(`Automation updated: ${updates.name}`);
  }

  searchDocuments(query: string): DocumentItem[] {
    const lowered = query.toLowerCase();
    return this.documentsSubject.value.filter(
      (document) =>
        document.name.toLowerCase().includes(lowered) ||
        document.content.toLowerCase().includes(lowered) ||
        document.summary.toLowerCase().includes(lowered)
    );
  }

  getPurchaseRequestPolicy(): { answer: string; source: string } {
    const policyDocument = this.searchDocuments('purchase request')[0];
    return {
      answer:
        policyDocument?.content ??
        'Purchase requests below ₱50,000 require department approval. Requests above ₱50,000 require Finance review.',
      source: policyDocument?.name ?? 'Purchase Request SOP.pdf'
    };
  }

  simulateSendEmail(subject: string): void {
    this.addActivity(`Email prepared successfully: ${subject}`);
  }

  createTasksFromMeeting(): void {
    const meeting = this.getMeetingSummary();
    const baseId = Math.max(...this.tasksSubject.value.map((task) => task.id), 0) + 1;
    const baseDate = new Date().toISOString().slice(0, 10);
    const newTasks = meeting.actionItems.map((item, index) => ({
      dueDate: this.shiftDate(baseDate, index),
      id: baseId + index,
      department: item.owner,
      title: item.action,
      status: 'Pending' as const,
      owner: item.owner,
      category: 'Meeting Follow-up'
    }));
    this.tasksSubject.next([...this.tasksSubject.value, ...newTasks]);
    this.addActivity('Meeting action items converted to tasks');
  }

  getReportsSnapshot(): Report[] {
    return this.clone(this.reportsSubject.value);
  }

  getTasksSnapshot(): Task[] {
    return this.clone(this.tasksSubject.value);
  }

  getDocumentsSnapshot(): DocumentItem[] {
    return this.clone(this.documentsSubject.value);
  }

  getAutomationsSnapshot(): Automation[] {
    return this.clone(this.automationsSubject.value);
  }

  getActivitiesSnapshot(): string[] {
    return this.clone(this.activitySubject.value);
  }

  private addActivity(message: string): void {
    this.activitySubject.next([message, ...this.activitySubject.value].slice(0, 8));
  }

  private clone<T>(value: T): T {
    return structuredClone(value);
  }

  private shiftDate(baseDate: string, dayOffset: number): string {
    const date = new Date(`${baseDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    return date.toISOString().slice(0, 10);
  }
}
