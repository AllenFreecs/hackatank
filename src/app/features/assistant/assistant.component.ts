import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { DataService } from '../../core/services/data.service';
import { NotificationService } from '../../core/services/notification.service';
import { ChatMessage } from '../../models/chat-message.model';
import { AiChatComponent } from '../../shared/components/ai-chat/ai-chat.component';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [AiChatComponent],
  template: '<h1>AI Assistant</h1><app-ai-chat [messages]="messages" [loading]="loading" [suggestions]="suggestions" (sendPrompt)="send($event)" (action)="handleAction($event.action, $event.message)" />',
  styles: ['h1 { margin: 0 0 1rem; color:#0f2a5f; }']
})
export class AssistantComponent {
  private readonly destroyRef = inject(DestroyRef);
  loading = false;
  messages: ChatMessage[] = [];
  suggestions = [
    'Show me the departments with the most pending tasks.',
    "Compare this month's sales with last month.",
    'Find the latest employee onboarding procedure.',
    'Summarize this meeting and identify action items.',
    'Draft an email about the delayed report.',
    'What should we automate?'
  ];

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

    this.notificationService.show(`${action} completed.`);
  }
}
