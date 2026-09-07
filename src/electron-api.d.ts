import { ChatMessage } from './app/models/chat-message.model';

declare global {
  interface Window {
    electronApi?: {
      askAssistant(prompt: string): Promise<Pick<ChatMessage, 'content' | 'source'>>;
    };
  }
}

export {};