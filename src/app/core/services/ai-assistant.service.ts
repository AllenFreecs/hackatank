import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { ChatMessage } from '../../models/chat-message.model';
import { DataService } from './data.service';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  constructor(private readonly dataService: DataService) {}

  respond(prompt: string): Observable<ChatMessage> {
    const lowered = prompt.toLowerCase();

    if (
      lowered.includes('set calendar') ||
      lowered.includes('schedule meeting') ||
      lowered.includes('calendar event') ||
      lowered.includes('book meeting')
    ) {
      return this.reply({
        content: 'Prepared a Teams/Outlook meeting draft for tomorrow at 10:30 AM (45m) with Finance and Operations leads.',
        table: {
          columns: ['Field', 'Value'],
          rows: [
            ['Title', 'MCP Weekly Sync'],
            ['Time', '10:30 AM'],
            ['Duration', '45m'],
            ['Owner', 'Operations PMO'],
            ['Channel', 'Teams / Exec Ops']
          ]
        },
        actions: ['Set Calendar Event', 'Comment on Thread', 'Find Related SharePoint Articles']
      });
    }

    if (
      lowered.includes('comment on thread') ||
      lowered.includes('post in teams') ||
      lowered.includes('thread update')
    ) {
      return this.reply({
        content:
          'Drafted a Teams thread update: "Power BI refresh completed, Azure alert triage in progress, and Outlook approvals are queued for sign-off."',
        actions: ['Post Comment to Thread', 'Set Calendar Event', 'Find Related SharePoint Articles']
      });
    }

    if (
      lowered.includes('sharepoint') ||
      lowered.includes('related article') ||
      lowered.includes('lookup article') ||
      lowered.includes('knowledge lookup')
    ) {
      const lookupTerm = this.extractLookupTerm(prompt);
      const related = this.dataService.lookupSharePointArticles(lookupTerm);

      if (!related.length) {
        return this.reply({
          content: `No SharePoint articles matched "${lookupTerm}". Try a broader query like onboarding, finance approval, or procurement.`,
          actions: ['Set Calendar Event', 'Post Comment to Thread']
        });
      }

      return this.reply({
        content: `Found ${related.length} related SharePoint article${related.length > 1 ? 's' : ''} for "${lookupTerm}".`,
        source: 'SharePoint Knowledge Hub',
        table: {
          columns: ['Article', 'Category', 'Relevance'],
          rows: related.map((entry) => [entry.name, entry.category, `${entry.relevance}%`])
        },
        actions: ['Open Top Article', 'Post Comment to Thread', 'Set Calendar Event']
      });
    }

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
      const policy = this.dataService.getPurchaseRequestPolicy();
      return this.reply({
        content: policy.answer,
        source: policy.source
      });
    }

    if (lowered.includes('sales')) {
      const sales = this.dataService.getSales();
      const previous = sales[0];
      const current = sales[1];
      if (!previous || !current) {
        return this.reply({ content: 'Sales data is currently unavailable.' });
      }
      const percent = ((current.amount - previous.amount) / previous.amount) * 100;
      return this.reply({
        content: `Sales increased from ₱${previous.amount.toLocaleString()} in ${previous.month} to ₱${current.amount.toLocaleString()} in ${current.month}.`,
        insight: `That is a ${percent.toFixed(2)}% month-over-month increase.`
      });
    }

    if (lowered.includes('summarize today') || lowered.includes('summarize this meeting')) {
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

  private extractLookupTerm(prompt: string): string {
    const lowered = prompt.toLowerCase();
    const markers = ['for ', 'about ', 'on '];
    for (const marker of markers) {
      const idx = lowered.indexOf(marker);
      if (idx >= 0) {
        const value = prompt.slice(idx + marker.length).trim();
        if (value.length > 2) {
          return value.replace(/[?.!,]+$/, '');
        }
      }
    }
    return 'operations';
  }
}
