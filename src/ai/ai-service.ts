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

    console.log('🧠 AI Service initialized');
    console.log(`API Key configured: ${this.apiKey ? 'YES' : 'NO'}`);
    console.log(`Default model: ${this.defaultModel}`);
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
      console.log('Building messages');
      let messages: ModelMessage[] = [];
      if (chatId) {
        const context = this.conversationManager.getConversationContext(chatId, options.maxMessages || 20);
        messages = [...context.messages];
        console.log(`Added ${messages.length} context messages`);
      }

      const userMessage: UserMessage = {
        role: 'user',
        content: [{ type: 'text', text: prompt } as TextPart]
      };
      messages.push(userMessage);
      console.log(`Total messages: ${messages.length}`);

      console.log('🚀 Calling Google AI SDK...');
      const result = await generateText({
        model: google(model),
        messages,
        tools,
        system: systemPrompt,
        maxRetries: 2
      });

      console.log('AI SDK returned result:', {
        hasText: !!result.text,
        textLength: result.text?.length || 0,
        hasToolCalls: !!(result.toolCalls?.length),
        hasSources: !!(result.sources?.length)
      });

      if (chatId) {
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: result.text || ''
        };
        this.conversationManager.addToConversationHistory(chatId, userMessage, assistantMessage);
        console.log('Added to conversation history');
      }

      const processedResponse = ResponseProcessor.processResponse(result);
      console.log('Processed response:', {
        hasContent: !!processedResponse.content,
        contentLength: processedResponse.content?.length || 0
      });

      return processedResponse;
    } catch (error) {
      console.error('❌ generateResponse: Error occurred:', error);
      throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateWithThinking(
    prompt: string,
    options: AIServiceOptions & { thinkingBudget?: number; includeThoughts?: boolean } = {},
    chatId?: string,
    senderName?: string
  ): Promise<AIResponse> {
    return generateThinking(
      prompt,
      options,
      chatId,
      senderName,
      this.conversationManager.conversations,
      (chatId: string, maxMessages: number) => this.conversationManager.getConversationContext(chatId, maxMessages),
      (chatId: string, userMessage: any, assistantMessage: any) => this.conversationManager.addToConversationHistory(chatId, userMessage, assistantMessage),
      this.defaultModel,
      20
    );
  }

  async generateWithMedia(
    prompt: string,
    mediaFiles: Array<{ data: Buffer; mediaType: string; filename?: string }>,
    options: AIServiceOptions = {},
    chatId?: string,
    senderName?: string
  ): Promise<AIResponse> {
    return generateWithMedia(
      prompt,
      mediaFiles,
      options,
      chatId,
      senderName,
      this.conversationManager.conversations,
      (chatId: string, maxMessages: number) => this.conversationManager.getConversationContext(chatId, maxMessages),
      (chatId: string, userMessage: any, assistantMessage: any) => this.conversationManager.addToConversationHistory(chatId, userMessage, assistantMessage),
      this.defaultModel,
      20
    );
  }

  getConversationSummary(chatId: string): { messageCount: number; lastActivity: Date | null } {
    return this.conversationManager.getConversationSummary(chatId);
  }

  clearConversation(chatId: string): void {
    this.conversationManager.clearConversation(chatId);
  }
}