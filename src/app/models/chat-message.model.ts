export interface ChatActionTable {
  columns: string[];
  rows: string[][];
}

export interface ChatFigure {
  label: string;
  value: string;
  delta?: string;
}

export interface ChatChart {
  title: string;
  labels: string[];
  values: number[];
  unit?: 'currency' | 'number' | 'percent';
}

export interface ChatFileLink {
  name: string;
  url: string;
  category: string;
  summary: string;
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
  figures?: ChatFigure[];
  chart?: ChatChart;
  fileLinks?: ChatFileLink[];
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
