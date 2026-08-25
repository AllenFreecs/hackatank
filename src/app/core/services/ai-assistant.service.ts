import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { ChatMessage } from '../../models/chat-message.model';
import { DataService } from './data.service';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  constructor(private readonly dataService: DataService) {}

  respond(prompt: string): Observable<ChatMessage> {
    const lowered = prompt.toLowerCase();

    if (lowered.includes('pending tasks') || lowered.includes('departments have')) {
      const rows = this.dataService.getPendingByDepartment().map((entry) => [entry.department, `${entry.pending}`]);
      return this.reply({
        content: 'Based on the current operational data, HR has the highest number of pending tasks.',
        table: { columns: ['Department', 'Pending'], rows },
        insight: "HR represents 46% of all pending tasks. The largest contributor is employee onboarding.",
        actions: ['Create Summary', 'Show Details', 'Draft Email', 'Create Tasks']
      });
    }

    if (lowered.includes('why does hr have so many pending tasks')) {
      return this.reply({
        content: "The largest contributor is employee onboarding, representing 61% of HR's pending tasks.",
        actions: ['Find Onboarding Procedure', 'Draft Email', 'Create Automation']
      });
    }

    if (lowered.includes('onboarding procedure') || lowered.includes('find the onboarding procedure')) {
      return this.reply({
        content: 'I found the latest onboarding reference document.',
        source: 'Employee Onboarding Procedure.pdf',
        insight: 'The process still includes manual verification steps that can be automated.',
        actions: ['Summarize Improvements', 'Draft Email', 'Create Automation']
      });
    }

    if (lowered.includes('summarize what needs to be improved')) {
      return this.reply({
        content: 'The procedure contains several manual verification steps that could be automated.',
        actions: ['Draft Email', 'Create Automation']
      });
    }

    if (lowered.includes('purchase request')) {
      return this.reply({
        content:
          'Purchase requests below ₱50,000 require department approval. Requests above ₱50,000 require Finance review.',
        source: 'Purchase Request SOP.pdf'
      });
    }

    if (lowered.includes('sales')) {
      const sales = this.dataService.getSales();
      const previous = sales[0];
      const current = sales[1];
      if (!previous || !current) {
        return this.reply({ content: 'Sales data is currently unavailable.' });
      }
      return this.reply({
        content: `Sales increased from ₱${previous.amount.toLocaleString()} in ${previous.month} to ₱${current.amount.toLocaleString()} in ${current.month}.`,
        insight: 'That is an 8.98% month-over-month increase.'
      });
    }

    if (lowered.includes('summarize today') || lowered.includes('meeting')) {
      const meeting = this.dataService.getMeetingSummary();
      return this.reply({
        content: 'Meeting summary prepared.',
        meetingSummary: {
          summary: meeting.summary,
          decisions: meeting.decisions,
          actionItems: meeting.actionItems
        },
        actions: ['Create Tasks']
      });
    }

    if (lowered.includes('what should we automate') || lowered.includes('manually checking reports')) {
      return this.reply({
        content: 'I found a potential automation opportunity.',
        automationSuggestion: {
          name: 'Automated Report Validation',
          currentProcess: ['Download report', 'Check missing values', 'Compare totals', 'Email exceptions'],
          improvement: 'Automatically validate the report and notify the owner only when exceptions are found.',
          opportunity: 'High'
        },
        actions: ['Explore', 'Create Prototype', 'Save Idea']
      });
    }

    if (lowered.includes('draft an email')) {
      return this.reply({
        content: 'Email draft prepared.',
        emailDraft: {
          subject: 'Operations Report Delay',
          body:
            'Hello Finance Team,\n\nWe detected a delay in this week\'s operations report due to unresolved verification checks. We recommend automating the validation workflow to reduce manual review and prevent recurring delays.\n\nBest regards,\nAI Assistant'
        },
        actions: ['Copy', 'Edit', 'Send']
      });
    }

    return this.reply({
      content:
        'I can help with reporting, knowledge search, meeting summaries, email drafting, and automation suggestions. Try one of the suggested prompts.',
      actions: ['Show Prompt Suggestions']
    });
  }

  private reply(partial: Omit<ChatMessage, 'id' | 'role' | 'timestamp'>): Observable<ChatMessage> {
    return of({
      id: Date.now(),
      role: 'assistant' as const,
      timestamp: new Date().toISOString(),
      ...partial
    }).pipe(delay(900));
  }
}
