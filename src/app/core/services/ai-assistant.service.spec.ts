import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AssistantComponent } from '../../features/assistant/assistant.component';
import { AiAssistantService } from './ai-assistant.service';

describe('AiAssistantService', () => {
  let service: AiAssistantService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
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
});
