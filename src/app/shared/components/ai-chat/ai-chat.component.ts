import { Component, EventEmitter, input, Output } from '@angular/core';
import { TextFieldModule } from '@angular/cdk/text-field';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ChatMessage } from '../../../models/chat-message.model';
import { DataTableComponent } from '../data-table/data-table.component';
import { LoadingStateComponent } from '../loading-state/loading-state.component';

interface ChartPoint {
  label: string;
  valueLabel: string;
  height: number;
}

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [
    FormsModule,
    TextFieldModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    DataTableComponent,
    LoadingStateComponent
  ],
  templateUrl: './ai-chat.component.html',
  styleUrl: './ai-chat.component.scss'
})
export class AiChatComponent {
  messages = input.required<ChatMessage[]>();
  loading = input<boolean>(false);
  suggestions = input.required<string[]>();

  draft = '';

  @Output() sendPrompt = new EventEmitter<string>();
  @Output() action = new EventEmitter<{ action: string; message: ChatMessage }>();

  onSend(prompt?: string): void {
    const text = (prompt ?? this.draft).trim();
    if (!text) {
      return;
    }
    this.sendPrompt.emit(text);
    this.draft = '';
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  roleLabel(message: ChatMessage): string {
    return message.role === 'user' ? 'You' : 'Assistant';
  }

  timestampLabel(message: ChatMessage): string {
    const timestamp = new Date(message.timestamp);
    return Number.isNaN(timestamp.getTime())
      ? ''
      : timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  meetingRows(message: ChatMessage): string[][] {
    if (!message.meetingSummary) {
      return [];
    }
    return message.meetingSummary.actionItems.map((item) => [item.owner, item.action, item.due]);
  }

  chartPoints(message: ChatMessage): ChartPoint[] {
    if (!message.chart) {
      return [];
    }

    const maxValue = Math.max(...message.chart.values, 1);
    return message.chart.labels.map((label, index) => {
      const value = message.chart?.values[index] ?? 0;
      return {
        label,
        valueLabel: this.formatChartValue(value, message.chart?.unit),
        height: Math.max((value / maxValue) * 100, 6)
      };
    });
  }

  private formatChartValue(value: number, unit: NonNullable<ChatMessage['chart']>['unit']): string {
    if (unit === 'currency') {
      return `₱${(value / 1000000).toFixed(2)}M`;
    }

    if (unit === 'percent') {
      return `${value}%`;
    }

    return value.toLocaleString();
  }
}
