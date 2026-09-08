import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AssistantComponent } from '../../features/assistant/assistant.component';
import { DataService } from './data.service';
import { AiAssistantService } from './ai-assistant.service';

describe('AiAssistantService', () => {
  let service: AiAssistantService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(AiAssistantService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns pending tasks analysis', async () => {
    const responsePromise = firstValueFrom(service.respond('Which departments have the most pending tasks?'));

    const req = httpMock.expectOne('http://127.0.0.1:3001/api/assistant');
    expect(req.request.method).toBe('POST');
    req.flush({
      content: 'Based on the current operational data, HR has the highest number of pending tasks.',
      table: {
        columns: ['Department', 'Pending'],
        rows: [['HR', '42'], ['Finance', '31'], ['Operations', '18']]
      },
      insight: 'HR represents 46% of all pending tasks. The largest contributor is employee onboarding.',
      source: 'Operational Dashboard'
    });

    const response = await responsePromise;
    expect(response.table?.rows[0][0]).toBe('HR');
    expect(response.insight).toContain('46%');
  });

  it('returns email draft for communication prompt', async () => {
    const responsePromise = firstValueFrom(service.respond('Draft an email about the delayed report.'));

    const req = httpMock.expectOne('http://127.0.0.1:3001/api/assistant');
    expect(req.request.method).toBe('POST');
    req.flush({
      content: 'Follow-up email draft prepared for the pending high and medium priority approvals.',
      emailDraft: {
        subject: 'Operations Report Delay',
        body: 'Hello team,\n\nPlease review the delayed report.'
      },
      source: 'Outlook Mailbox'
    });

    const response = await responsePromise;
    expect(response.emailDraft?.subject).toContain('Operations Report Delay');
  });

  it('stores the generated email as an .eml artifact', () => {
    const dataService = TestBed.inject<DataService>(DataService);
    const outputPath = dataService.simulateSendEmail('Quarterly update', 'Hello team,\n\nThis is the approved update.');

    expect(outputPath).toContain('export/eml/');
    expect(outputPath).toContain('.eml');
    expect(dataService.getEmailFilesSnapshot()[0]).toEqual(
      jasmine.objectContaining({
        name: jasmine.stringMatching(/quarterly-update\.eml/),
        content: jasmine.stringContaining('This is the approved update.')
      })
    );
  });

  it('exports an assistant response with the selected filename and type', () => {
    const dataService = TestBed.inject<DataService>(DataService);
    const outputPath = dataService.exportAssistantResponse('Finance Approval Summary', 'excel', 'Approval summary content.');

    expect(outputPath).toBe('export/excel/finance-approval-summary.xlsx');
    expect(dataService.getActivitiesSnapshot()[0]).toContain('finance-approval-summary.xlsx');
  });

  it('persists created automations to local storage', () => {
    const dataService = TestBed.inject(DataService);
    localStorage.clear();

    dataService.addAutomation({
      name: 'Local storage export',
      trigger: 'Daily 9 AM',
      action: 'Export pdf report',
      frequency: 'Daily',
      recipient: 'ops@example.com',
      automationType: 'File Creation',
      fileType: 'pdf',
      aiQuery: 'Create a daily PDF export for operations.',
      status: 'Enabled'
    });

    const stored = JSON.parse(localStorage.getItem('hackatank.automations') ?? '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].name).toBe('Local storage export');
    expect(stored[0].aiQuery).toBe('Create a daily PDF export for operations.');
  });

  it('requires automation details before creating a saved automation and does not load seed automations', async () => {
    const dataService = TestBed.inject(DataService);
    expect(dataService.getAutomationsSnapshot()).toEqual([]);

    const response: any = await firstValueFrom(
      (service as any).respondLocally(
        'Create an automation called Daily PDF export. Automation Type: File Creation. Frequency: every 5 minutes. FileType: pdf.'
      )
    );

    expect(response.content).toContain('Daily PDF export');
    expect(dataService.getAutomationsSnapshot().length).toBe(1);
    expect(dataService.getAutomationsSnapshot()[0]).toEqual(
      jasmine.objectContaining({
        name: 'Daily PDF export',
        automationType: 'File Creation',
        frequency: 'every 5 minutes',
        fileType: 'pdf',
        status: 'Enabled'
      })
    );
  });
});

describe('AssistantComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AssistantComponent, HttpClientTestingModule]
    });
  });

  it('does not include a Power BI workspace preset', () => {
    const fixture = TestBed.createComponent(AssistantComponent);
    expect(fixture.componentInstance.presets).not.toContain('Power BI Workspace');
  });

  it('parses a work-item reply prompt and extracts the comment body', () => {
    const fixture = TestBed.createComponent(AssistantComponent);
    const component = fixture.componentInstance as any;

    expect(component.extractWorkItemReference('Reply to workitem 205283: Approved and ready.')).toBe('205283');
    expect(component.extractReplyComment('Reply to workitem 205283: Approved and ready.')).toBe('Approved and ready.');
  });
});
