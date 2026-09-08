import { ChatMessage } from './app/models/chat-message.model';

declare global {
  interface Window {
    electronApi?: {
      askAssistant(
        prompt: string,
        history?: Array<Pick<ChatMessage, 'role' | 'content'>>
      ): Promise<Pick<ChatMessage, 'content' | 'source'> & Partial<Pick<ChatMessage, 'table' | 'chart' | 'actions'>>>;
    };
  }
}

export {};