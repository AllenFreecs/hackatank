import { Component, DestroyRef, inject, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { DataService } from '../../core/services/data.service';
import { NotificationService } from '../../core/services/notification.service';
import { ChatMessage } from '../../models/chat-message.model';
import { AiChatComponent } from '../../shared/components/ai-chat/ai-chat.component';
import { EmailDetailsDialogComponent } from './email-details-dialog.component';
import { ExportDetailsDialogComponent } from './export-details-dialog.component';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatDialogModule, AiChatComponent],
  template: `
    <section class="assistant-page">
      <header>
        <div>
          <h1>AI Assistant</h1>
          <p>Ask, analyze, and automate with an interactive workspace-style chat.</p>
        </div>

        <mat-form-field appearance="outline" class="preset-field">
          <mat-label>Assistant preset</mat-label>
          <mat-select [(ngModel)]="selectedPreset">
            @for (preset of presets; track preset) {
              <mat-option [value]="preset">{{ preset }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </header>

      <app-ai-chat
        [messages]="messages"
        [loading]="loading"
        [suggestions]="activeSuggestions"
        (sendPrompt)="send($event)"
        (action)="handleAction($event.action, $event.message)"
        (pinMessage)="togglePinnedMessage($event)"
        (newChat)="startNewChat()"
      />
    </section>
  `,
  styles: [
    `
      .assistant-page {
        display: grid;
        gap: 1rem;
      }

      header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      h1 {
        margin: 0 0 0.35rem;
        color: var(--app-heading);
      }

      p {
        margin: 0;
        color: var(--app-muted);
      }

      .preset-field {
        width: min(100%, 320px);
      }

      @media (max-width: 720px) {
        header {
          display: grid;
        }

        .preset-field {
          width: 100%;
        }
      }
    `
  ]
})
export class AssistantComponent {
  private readonly destroyRef = inject(DestroyRef);
  loading = false;
  presets = ['Azure Monitor', 'SharePoint Knowledge Hub', 'Teams Calendar', 'Outlook Mailbox'];
  selectedPreset = this.presets[0];
  messages: ChatMessage[] = [AssistantComponent.welcomeMessage()];

  suggestionsByPreset: Record<string, string[]> = {
    'Azure Monitor': [
      'Show Azure task health by status.',
      'Chart Azure sprint work by lane.',
      'Chart Azure bugs',
      'Update workitem status and add a comment.',
      'Show items user is tagged in.'
    ],
    'SharePoint Knowledge Hub': [
      'Find files related to employee onboarding.',
      'Show SharePoint files about finance approvals.',
      'Get document links for procurement info.',
      'Find support SLA files and links.'
    ],
    'Teams Calendar': [
      'Show Teams activity summary.',
      'Chart Teams chats by channel.',
      'Show Teams calendar workload.',
      'Summarize Teams calls today.',
      'Show Teams channels engagement.'
    ],
    'Outlook Mailbox': [
      'Show Outlook email priority queue.',
      'Chart Outlook emails by sender.',
      'Summarize pending approval emails.',
      'Draft a follow-up email for overdue approvals.',
      'Show unread Outlook email workload.'
    ]
  };

  get activeSuggestions(): string[] {
    return this.suggestionsByPreset[this.selectedPreset] ?? [];
  }

  private static welcomeMessage(): ChatMessage {
    return {
      id: Date.now(),
      role: 'assistant',
      content: 'Welcome. I can help with operations insights, summaries, and task automation. What should we tackle first?',
      timestamp: new Date().toISOString()
    };
  }

  startNewChat(): void {
    this.loading = false;
    this.messages = [AssistantComponent.welcomeMessage()];
    this.chat?.focusComposer('');
  }

  @ViewChild(AiChatComponent) private readonly chat?: AiChatComponent;

  constructor(
    private readonly assistantService: AiAssistantService,
    private readonly dataService: DataService,
    private readonly notificationService: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  send(prompt: string): void {
    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString()
    };
    const history = this.messages.slice(-10).map((message) => ({ role: message.role, content: message.content }));
    this.messages = [...this.messages, userMessage];
    this.loading = true;
    if (this.isEmailCommand(prompt) && !this.extractEmailQuery(prompt)) {
      const pinnedMessage = this.messages.find((message) => message.pinned && message.role === 'assistant');
      if (pinnedMessage) {
        this.loading = false;
        this.openEmailDialog(pinnedMessage);
        return;
      }
    }
    if (this.isExportCommand(prompt)) {
      const pinnedMessage = this.messages.find((message) => message.pinned && message.role === 'assistant');
      if (pinnedMessage) {
        this.loading = false;
        this.openExportDialog(pinnedMessage);
        return;
      }
    }
    const assistantPrompt = this.extractEmailQuery(prompt) ?? prompt;
    this.assistantService
      .respond(assistantPrompt, history)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((reply) => {
        this.messages = [...this.messages, reply];
        this.loading = false;
        this.maybeHandleAutomationPrompt(prompt, reply);
      });
  }

  private extractEmailQuery(prompt: string): string | null {
    const match = /^(?:email me this|send email(?: this)?)\s*[:\-,]?\s*(.+)$/i.exec(prompt.trim());
    return match?.[1]?.trim() || null;
  }

  private isEmailCommand(prompt: string): boolean {
    return /^(?:email me this|send email(?: this)?)\s*[:\-,]?\s*.*$/i.test(prompt.trim());
  }

  private isExportCommand(prompt: string): boolean {
    return /^(?:export|download)(?: this)?\s*$/i.test(prompt.trim());
  }

  togglePinnedMessage(message: ChatMessage): void {
    this.messages = this.messages.map((entry) =>
      entry.id === message.id ? { ...entry, pinned: !entry.pinned } : { ...entry, pinned: false }
    );
    this.notificationService.show(message.pinned ? 'Message unpinned.' : 'Message pinned.');
  }

  private maybeHandleAutomationPrompt(prompt: string, reply: ChatMessage): void {
    const lower = prompt.toLowerCase();
    if (!/comment to workitem|reply to workitem|reply this|email me this|send email|make an autoamation|make an automation|automation name|filetype|file type/iu.test(prompt)) {
      return;
    }

    const workItemId = this.extractWorkItemReference(prompt) ?? this.extractWorkItemReference(reply.content ?? '') ?? this.extractWorkItemReference(reply.source ?? '');
    if ((/comment to workitem|reply to workitem|reply this|comment on work item|comment to work item/i.test(prompt) || (/work item/i.test(prompt) && /reply|comment/i.test(prompt))) && workItemId) {
      const comment = this.extractReplyComment(prompt) || reply.content || 'Follow-up complete.';
      const result = this.dataService.createWorkItemComment(workItemId, comment);
      this.notificationService.show(result);
      return;
    }

    if (/email me this|send email/i.test(prompt)) {
      this.openEmailDialog(reply);
      return;
    }

    if (/make an autoamation|make an automation/i.test(prompt) || (/automation name/i.test(prompt) && /filetype|file type|frequency/i.test(prompt))) {
      const automationName = this.extractPromptValue(prompt, 'Automation name');
      const automationType = this.extractPromptValue(prompt, 'Automation Type') || 'File Creation';
      const frequency = this.extractPromptValue(prompt, 'Frequency') || 'every 5 minutes';
      const fileType = this.extractPromptValue(prompt, 'FileType') || this.extractPromptValue(prompt, 'File Type') || 'pdf';
      const created = this.dataService.addAutomation({
        name: automationName || 'New scheduled automation',
        trigger: frequency,
        action: automationType === 'Email Creation' ? 'Create email content' : `Export ${fileType} report`,
        frequency,
        recipient: automationType === 'Email Creation' ? 'user@company.com' : 'operations@company.com',
        automationType: automationType as 'File Creation' | 'Email Creation',
        fileType: automationType === 'Email Creation' ? undefined : (fileType.toLowerCase() as 'excel' | 'word' | 'pdf'),
        aiQuery: prompt,
        status: 'Enabled'
      });
      this.notificationService.show(`Automation created: ${created.name}`);
    }
  }

  private openEmailDialog(message: ChatMessage): void {
    this.dialog
      .open(EmailDetailsDialogComponent, {
        width: 'min(620px, calc(100vw - 32px))',
        data: {
          recipient: 'user@company.com',
          subject: message.emailDraft?.subject ?? 'AI Assistant follow-up',
          body: message.emailDraft?.body ?? this.formatMessageForEmail(message)
        }
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result?: { recipient: string; subject: string }) => {
        if (!result) {
          return;
        }

        const body = message.emailDraft?.body ?? this.formatMessageForEmail(message);
        const output = this.dataService.simulateSendEmail(result.subject, body, result.recipient);
        this.notificationService.show(`EML file created: ${output}`);
      });
  }

  private openExportDialog(message: ChatMessage): void {
    this.dialog
      .open(ExportDetailsDialogComponent, {
        width: 'min(520px, calc(100vw - 32px))',
        data: { filename: this.defaultExportFilename(message) }
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result?: { filename: string; fileType: 'excel' | 'word' | 'pdf' }) => {
        if (!result) {
          return;
        }

        const output = this.dataService.exportAssistantResponse(result.filename, result.fileType, this.formatMessageForEmail(message));
        this.notificationService.show(`Response exported: ${output}`);
      });
  }

  private defaultExportFilename(message: ChatMessage): string {
    const source = message.source?.trim() || 'assistant-response';
    return source.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'assistant-response';
  }

  private extractPromptValue(prompt: string, key: string): string {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`${escapedKey}\s*[:\\-]\s*([^\\n.;]+)`, 'i').exec(prompt);
    return match ? match[1].trim() : '';
  }

  private extractWorkItemReference(text: string): string | null {
    const match = /(?:workitem|work item)\s*#?(\d+)/i.exec(text ?? '');
    return match ? match[1] : null;
  }

  private extractReplyComment(text: string): string {
    const match = /(?:comment to workitem|reply to workitem|reply this|comment on work item|comment to work item)\s*(?:#?\d+)?\s*[:\-]?\s*(.+)$/i.exec(text ?? '');
    if (match?.[1]) {
      return match[1].trim();
    }

    const fallback = /(?:reply|comment)\s+(?:to|on)\s+(?:workitem|work item)\s*(?:#?\d+)?\s*[:\-]?\s*(.+)$/i.exec(text ?? '');
    return fallback?.[1]?.trim() ?? '';
  }

  handleAction(action: string, message: ChatMessage): void {
    if (action === 'Proceed updating') {
      this.send('Yes, proceed with that update exactly as described.');
      return;
    }

    if (action === 'Reply to Work Item') {
      const workItemId = this.extractWorkItemReference(message.source ?? '') ?? this.extractWorkItemReference(message.content ?? '') ?? 'selected work item';
      const comment = this.extractReplyComment(message.content ?? '') || 'Follow-up complete.';
      const result = this.dataService.createWorkItemComment(workItemId, comment);
      this.notificationService.show(result);
      return;
    }

    if (action === 'Create Email File') {
      this.openEmailDialog(message);
      return;
    }

    if (action === 'Create Automation from Prompt') {
      const created = this.dataService.addAutomation({
        name: message.content || 'Scheduled automation',
        frequency: 'every 5 minutes',
        automationType: 'File Creation',
        fileType: 'pdf',
        status: 'Enabled'
      });
      this.notificationService.show(`Automation created: ${created.name}`);
      return;
    }

    if (action === 'Let me edit the information again') {
      this.chat?.focusComposer('Change the update to: ');
      return;
    }

    if (action === 'Custom answer') {
      this.chat?.focusComposer('');
      return;
    }

    if (action === 'Create Tasks') {
      this.dataService.createTasksFromMeeting();
      this.notificationService.show('Tasks created from AI recommendation.');
      return;
    }

    if (action === 'Send' && message.emailDraft) {
      this.openEmailDialog(message);
      return;
    }

    if (action === 'Create Automation') {
      const created = this.dataService.addAutomation({
        name: 'Automated onboarding status tracking',
        trigger: 'Daily 4:00 PM',
        action: 'Sync onboarding tracker',
        frequency: 'Daily',
        recipient: 'hr@company.com',
        status: 'Enabled'
      });
      this.notificationService.show(`Automation created: ${created.name}`);
      return;
    }

    if (action === 'Set Calendar Event') {
      const event = this.dataService.createCalendarEvent({
        title: 'MCP Weekly Sync',
        time: '10:30 AM',
        duration: '45m',
        owner: 'Operations PMO',
        channel: 'Teams / Exec Ops'
      });
      this.notificationService.show(`Calendar event created: ${event.title} (${event.time})`);
      return;
    }

    if (action === 'Post Comment to Thread' || action === 'Comment on Thread') {
      this.dataService.postTeamsThreadComment(
        'MCP Operations Updates',
        'Power BI refresh completed, Azure triage ongoing, and Outlook approvals queued for review.'
      );
      this.notificationService.show('Comment posted to Teams thread.');
      return;
    }

    if (action === 'Find Related SharePoint Articles') {
      const matches = this.dataService.lookupSharePointArticles('onboarding automation');
      this.notificationService.show(`SharePoint lookup completed: ${matches.length} related article${matches.length === 1 ? '' : 's'} found.`);
      return;
    }

    if (action === 'Open Top Article') {
      const top = this.dataService.lookupSharePointArticles('onboarding automation')[0];
      this.notificationService.show(top ? `Opening article: ${top.name}` : 'No related SharePoint articles found.');
      return;
    }

    this.notificationService.show(`${action} completed.`);
  }

  private formatMessageForEmail(message: ChatMessage): string {
    const sections = [message.content];

    if (message.figures?.length) {
      sections.push(`Figures:\n${message.figures.map((figure) => `- ${figure.label}: ${figure.value}${figure.delta ? ` (${figure.delta})` : ''}`).join('\n')}`);
    }

    if (message.chart) {
      sections.push(`Chart: ${message.chart.title}\n${message.chart.labels.map((label, index) => `${label}: ${message.chart?.values[index] ?? 0}${message.chart?.unit ? ` ${message.chart.unit}` : ''}`).join('\n')}`);
    }

    if (message.table) {
      sections.push(`Table:\n${message.table.columns.join(' | ')}\n${message.table.rows.map((row) => row.join(' | ')).join('\n')}`);
    }

    if (message.insight) {
      sections.push(`Insight: ${message.insight}`);
    }

    if (message.source) {
      sections.push(`Source: ${message.source}`);
    }

    return sections.join('\n\n');
  }
}
