import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import {
  UserMessage,
  AssistantMessage,
  ModelMessage,
  TextPart,
  AIServiceOptions,
  AIResponse
} from '../../types';
import { ConversationManager } from './conversation-manager';
import { ToolManager } from './tool-manager';
import { ResponseProcessor } from './response-processor';
import { generateWithThinking as generateThinking, generateWithFiles, generateWithMedia } from './ai-extensions';

export class AIService {
  private apiKey: string;
  private defaultModel: string;
  private conversationManager: ConversationManager;

  constructor() {
    this.apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is required');
    }
    this.defaultModel = 'gemini-2.5-flash';
    this.conversationManager = new ConversationManager();
  }

  async generateResponse(
    prompt: string,
    options: AIServiceOptions = {},
    chatId?: string,
    senderName?: string
  ): Promise<AIResponse> {
    const {
      model = this.defaultModel,
      systemPrompt,
      useSearch = false,
      useUrlContext = false,
      useCodeExecution = false
    } = options;

    const tools = ToolManager.getTools(useSearch, useUrlContext, useCodeExecution);

    try {
      let messages: ModelMessage[] = [];
      if (chatId) {
        const context = this.conversationManager.getConversationContext(chatId, options.maxMessages || 20);
        messages = [...context.messages];
      }

      const userMessage: UserMessage = {
        role: 'user',
        content: [{ type: 'text', text: prompt } as TextPart]
      };
      messages.push(userMessage);

      const result = await generateText({
        model: google(model),
        messages,
        tools,
        system: systemPrompt,
        maxRetries: 2
      });

      if (chatId) {
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: result.text
        };
        this.conversationManager.addToConversationHistory(chatId, userMessage, assistantMessage);
      }

      return ResponseProcessor.processResponse(result);
    } catch (error) {
      throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateWithThinking(
    prompt: string,
    options: AIServiceOptions & { thinkingBudget?: number; includeThoughts?: boolean } = {},
    chatId?: string,
    senderName?: string
  ): Promise<AIResponse> {
    return generateThinking(prompt, options, chatId, senderName);
  }

  async generateWithMedia(
    prompt: string,
    mediaFiles: Array<{ data: Buffer; mediaType: string; filename?: string }>,
    options: AIServiceOptions = {},
    chatId?: string,
    senderName?: string
  ): Promise<AIResponse> {
    return generateWithMedia(prompt, mediaFiles, options, chatId, senderName);
  }

  getConversationSummary(chatId: string): { messageCount: number; lastActivity: Date | null } {
    return this.conversationManager.getConversationSummary(chatId);
  }

  clearConversation(chatId: string): void {
    this.conversationManager.clearConversation(chatId);
  }
}