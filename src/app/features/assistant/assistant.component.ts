import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { DataService } from '../../core/services/data.service';
import { NotificationService } from '../../core/services/notification.service';
import { ChatMessage } from '../../models/chat-message.model';
import { AiChatComponent } from '../../shared/components/ai-chat/ai-chat.component';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, AiChatComponent],
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
  presets = ['Power BI Workspace', 'Azure Monitor', 'SharePoint Knowledge Hub', 'Teams Calendar', 'Outlook Mailbox'];
  selectedPreset = this.presets[0];
  messages: ChatMessage[] = [
    {
      id: 1,
      role: 'assistant',
      content: 'Welcome. I can help with operations insights, summaries, and task automation. What should we tackle first?',
      timestamp: new Date().toISOString()
    }
  ];
  suggestionsByPreset: Record<string, string[]> = {
    'Power BI Workspace': [
      'Show me the Power BI revenue pipeline and closed-won trend.',
      'Summarize report exceptions and owners.',
      'Show me the departments with the most pending tasks.',
      'What should we automate?'
    ],
    'Azure Monitor': [
      'Show Azure task health by status.',
      'Chart Azure sprint work by lane.',
      'Show Azure Power BI monitor metrics.',
      'Chart Azure bugs by severity.'
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

  constructor(
    private readonly assistantService: AiAssistantService,
    private readonly dataService: DataService,
    private readonly notificationService: NotificationService
  ) {}

  send(prompt: string): void {
    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString()
    };
    this.messages = [...this.messages, userMessage];
    this.loading = true;
    this.assistantService
      .respond(prompt)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((reply) => {
        this.messages = [...this.messages, reply];
        this.loading = false;
      });
  }

  handleAction(action: string, message: ChatMessage): void {
    if (action === 'Create Tasks') {
      this.dataService.createTasksFromMeeting();
      this.notificationService.show('Tasks created from AI recommendation.');
      return;
    }

    if (action === 'Send' && message.emailDraft) {
      this.dataService.simulateSendEmail(message.emailDraft.subject);
      this.notificationService.show('Email prepared successfully.');
      return;
    }

    if (action === 'Create Automation') {
      this.dataService.addAutomation({
        name: 'Automated onboarding status tracking',
        trigger: 'Daily 4:00 PM',
        action: 'Sync onboarding tracker',
        frequency: 'Daily',
        recipient: 'hr@company.com'
      });
      this.notificationService.show('Automation created: Automated onboarding status tracking.');
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
}
