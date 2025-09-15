import { ConversationContext, UserMessage, AssistantMessage } from '../../types';
import { cleanupExpiredConversations, limitConversationMessages } from './ai-utils';

export class ConversationManager {
  private conversationHistory: Map<string, ConversationContext> = new Map();
  private readonly MAX_HISTORY_AGE = 24 * 60 * 60 * 1000;
  private readonly DEFAULT_MAX_MESSAGES = 20;

  getConversationContext(chatId: string, maxMessages: number = this.DEFAULT_MAX_MESSAGES): ConversationContext {
    let context = this.conversationHistory.get(chatId);
    if (!context) {
      context = {
        chatId,
        messages: [],
        lastActivity: new Date()
      };
      this.conversationHistory.set(chatId, context);
    }

    cleanupExpiredConversations(this.conversationHistory, this.MAX_HISTORY_AGE);
    context.messages = limitConversationMessages(context.messages, maxMessages);

    return context;
  }

  addToConversationHistory(chatId: string, userMessage: UserMessage, assistantMessage: AssistantMessage): void {
    const context = this.conversationHistory.get(chatId);
    if (context) {
      context.messages.push(userMessage, assistantMessage);
      context.lastActivity = new Date();
    }
  }

  getConversationSummary(chatId: string): { messageCount: number; lastActivity: Date | null } {
    const context = this.conversationHistory.get(chatId);
    return {
      messageCount: context?.messages.length || 0,
      lastActivity: context?.lastActivity || null
    };
  }

  clearConversation(chatId: string): void {
    this.conversationHistory.delete(chatId);
  }

  get conversations(): Map<string, ConversationContext> {
    return this.conversationHistory;
  }
}