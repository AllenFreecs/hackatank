import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AiAssistantService } from './ai-assistant.service';

describe('AiAssistantService', () => {
  let service: AiAssistantService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiAssistantService);
  });

  it('returns pending tasks analysis', async () => {
    const response = await firstValueFrom(service.respond('Which departments have the most pending tasks?'));
    expect(response.table?.rows[0][0]).toBe('HR');
    expect(response.insight).toContain('46%');
  });

  it('returns email draft for communication prompt', async () => {
    const response = await firstValueFrom(service.respond('Draft an email about the delayed report.'));
    expect(response.emailDraft?.subject).toContain('Operations Report Delay');
  });
});
