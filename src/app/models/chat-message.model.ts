export interface ChatActionTable {
  columns: string[];
  rows: string[][];
}

export interface MeetingActionItem {
  owner: string;
  action: string;
  due: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  insight?: string;
  source?: string;
  table?: ChatActionTable;
  actions?: string[];
  emailDraft?: { subject: string; body: string };
  meetingSummary?: { summary: string; decisions: string[]; actionItems: MeetingActionItem[] };
  automationSuggestion?: {
    name: string;
    currentProcess: string[];
    improvement: string;
    opportunity: 'High' | 'Medium' | 'Low';
  };
}
