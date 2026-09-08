import { Component, ElementRef, EventEmitter, input, Output, ViewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TextFieldModule } from '@angular/cdk/text-field';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ChatMessage } from '../../../models/chat-message.model';
import { DataTableComponent } from '../data-table/data-table.component';
import { LoadingStateComponent } from '../loading-state/loading-state.component';

interface ChartPoint {
  label: string;
  valueLabel: string;
  height: number;
}

interface PieSlice {
  label: string;
  valueLabel: string;
  percent: number;
  color: string;
}

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    TextFieldModule,
    MatCardModule,
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
  private static readonly PIE_COLORS = ['#6d28d9', '#2563eb', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6'];

  messages = input.required<ChatMessage[]>();
  loading = input<boolean>(false);
  suggestions = input.required<string[]>();

  draft = '';
  composerFocused = false;

  @ViewChild('composerInput') private readonly composerInput?: ElementRef<HTMLTextAreaElement>;

  @Output() sendPrompt = new EventEmitter<string>();
  @Output() action = new EventEmitter<{ action: string; message: ChatMessage }>();
  @Output() newChat = new EventEmitter<void>();

  focusComposer(draft?: string): void {
    if (draft !== undefined) {
      this.draft = draft;
    }
    const element = this.composerInput?.nativeElement;
    if (!element) {
      return;
    }
    element.focus();
    const end = element.value.length;
    element.setSelectionRange(end, end);
  }

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

  isPieChart(message: ChatMessage): boolean {
    return message.chart?.type === 'pie';
  }

  pieSlices(message: ChatMessage): PieSlice[] {
    if (!message.chart) {
      return [];
    }

    const total = message.chart.values.reduce((sum, value) => sum + value, 0);
    return message.chart.labels.map((label, index) => {
      const value = message.chart?.values[index] ?? 0;
      return {
        label,
        valueLabel: this.formatChartValue(value, message.chart?.unit),
        percent: total > 0 ? (value / total) * 100 : 0,
        color: AiChatComponent.PIE_COLORS[index % AiChatComponent.PIE_COLORS.length]
      };
    });
  }

  pieGradient(message: ChatMessage): string {
    const slices = this.pieSlices(message);
    if (!slices.length) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)';
    }

    let cursor = 0;
    const stops = slices.map((slice) => {
      const start = cursor;
      cursor += (slice.percent / 100) * 360;
      return `${slice.color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
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
