import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { readFileSync } from 'fs';
import {
  UserMessage,
  AssistantMessage,
  ModelMessage,
  TextPart,
  ImagePart,
  FilePart,
  AIServiceOptions,
  ConversationContext,
  AIResponse
} from './types';
import { getMediaType, cleanupExpiredConversations, limitConversationMessages } from './ai-utils';
import { generateWithThinking as generateThinking, generateWithFiles, generateWithMedia } from './ai-extensions';

export class AIService {
  private apiKey: string;
  private defaultModel: string;
  private conversationHistory: Map<string, ConversationContext> = new Map();
  private readonly MAX_HISTORY_AGE = 24 * 60 * 60 * 1000;
  private readonly DEFAULT_MAX_MESSAGES = 20;

  constructor() {
    this.apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is required');
    }
    this.defaultModel = 'gemini-2.5-flash';
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

    const tools: any = {};

    if (useSearch) {
      tools.google_search = google.tools.googleSearch({});
    }

    if (useUrlContext) {
      tools.url_context = google.tools.urlContext({});
    }

    if (useCodeExecution) {
      tools.code_execution = google.tools.codeExecution({});
    }

    try {
      // Get conversation context if chatId is provided
      let messages: ModelMessage[] = [];

      if (chatId) {
        const context = this.getConversationContext(chatId, options.maxMessages || this.DEFAULT_MAX_MESSAGES);
        messages = [...context.messages];
      }

      // Add the new user message
      const userMessage: UserMessage = {
        role: 'user',
        content: senderName ? `${senderName}: ${prompt}` : prompt
      };
      messages.push(userMessage);

      const result = await generateText({
        model: google(model),
        system: systemPrompt,
        messages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
      });

      // Store the assistant's response in conversation history
      if (chatId) {
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: result.text
        };
        this.addToConversationHistory(chatId, userMessage, assistantMessage);
      }

      // Tool call detection for Google search
      let toolCalls = result.toolCalls || [];

      // If we have sources but no explicit tool calls, infer Google search was used
      if ((result.sources && result.sources.length > 0) ||
          (result.providerMetadata?.google?.groundingMetadata && !toolCalls.length)) {
        toolCalls.push({
          toolCallId: 'google-search-inferred',
          toolName: 'google_search',
          args: { query: 'search query inferred from sources' }
        } as any);
      }

      return {
        text: result.text,
        sources: result.sources,
        groundingMetadata: result.providerMetadata?.google?.groundingMetadata,
        toolCalls: toolCalls,
        toolResults: result.toolResults,
      };
    } catch (error) {
      console.error('AI Service Error:', error);
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async streamResponse(
    prompt: string,
    options: AIServiceOptions = {},
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const {
      model = this.defaultModel,
      systemPrompt,
      useSearch = false,
      useUrlContext = false,
      useCodeExecution = false
    } = options;

    const tools: any = {};

    if (useSearch) {
      tools.google_search = google.tools.googleSearch({});
    }

    if (useUrlContext) {
      tools.url_context = google.tools.urlContext({});
    }

    if (useCodeExecution) {
      tools.code_execution = google.tools.codeExecution({});
    }

    try {
      const result = await streamText({
        model: google(model),
        system: systemPrompt,
        prompt,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
      });

      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      return fullText;
    } catch (error) {
      console.error('AI Stream Error:', error);
      throw new Error(`AI streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateWithFiles(
    prompt: string,
    filePaths: string[],
    options: AIServiceOptions = {}
  ): Promise<AIResponse> {
    const {
      model = this.defaultModel,
      systemPrompt,
      useSearch = false,
      useUrlContext = false,
      useCodeExecution = false
    } = options;

    const tools: any = {};

    if (useSearch) {
      tools.google_search = google.tools.googleSearch({});
    }

    if (useUrlContext) {
      tools.url_context = google.tools.urlContext({});
    }

    if (useCodeExecution) {
      tools.code_execution = google.tools.codeExecution({});
    }

    const fileContents = filePaths.map(path => {
      try {
        const data = readFileSync(path);
        const mediaType = getMediaType(path);
        return { type: 'file' as const, data: data as any, mediaType };
      } catch (error) {
        console.error(`Failed to read file ${path}:`, error);
        return null;
      }
    }).filter((item): item is any => item !== null);

    try {
      const result = await generateText({
        model: google(model),
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...fileContents
            ],
          },
        ],
        tools: Object.keys(tools).length > 0 ? tools : undefined,
      });

      // Tool call detection for Google search
      let toolCalls = result.toolCalls || [];

      // If we have sources but no explicit tool calls, infer Google search was used
      if ((result.sources && result.sources.length > 0) ||
          (result.providerMetadata?.google?.groundingMetadata && !toolCalls.length)) {
        toolCalls.push({
          toolCallId: 'google-search-inferred',
          toolName: 'google_search',
          args: { query: 'search query inferred from sources' }
        } as any);
      }

      return {
        text: result.text,
        sources: result.sources,
        groundingMetadata: result.providerMetadata?.google?.groundingMetadata,
        toolCalls: toolCalls,
        toolResults: result.toolResults,
      };
    } catch (error) {
      console.error('AI Service File Error:', error);
      throw new Error(`AI file generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateWithThinking(
    prompt: string,
    options: AIServiceOptions & { thinkingBudget?: number; includeThoughts?: boolean } = {},
    chatId?: string,
    senderName?: string
  ): Promise<AIResponse> {
    const {
      model = 'gemini-2.5-flash',
      systemPrompt,
      useSearch = false,
      useUrlContext = false,
      useCodeExecution = false,
      thinkingBudget = 8192,
      includeThoughts = true
    } = options;

    const tools: any = {};

    if (useSearch) {
      tools.google_search = google.tools.googleSearch({});
    }

    if (useUrlContext) {
      tools.url_context = google.tools.urlContext({});
    }

    if (useCodeExecution) {
      tools.code_execution = google.tools.codeExecution({});
    }

    try {
      // Get conversation context if chatId is provided
      let messages: ModelMessage[] = [];

      if (chatId) {
        const context = this.getConversationContext(chatId, options.maxMessages || this.DEFAULT_MAX_MESSAGES);
        messages = [...context.messages];
      }

      // Add the new user message
      const userMessage: UserMessage = {
        role: 'user',
        content: senderName ? `${senderName}: ${prompt}` : prompt
      };
      messages.push(userMessage);

      const result = await generateText({
        model: google(model),
        system: systemPrompt,
        messages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        providerOptions: {
          google: {
            thinkingConfig: {
              thinkingBudget,
              includeThoughts,
            },
          },
        },
      });

      // Store the assistant's response in conversation history
      if (chatId) {
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: result.text
        };
        this.addToConversationHistory(chatId, userMessage, assistantMessage);
      }

      return {
        text: result.text,
        sources: result.sources,
        groundingMetadata: result.providerMetadata?.google?.groundingMetadata,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
        reasoning: Array.isArray(result.reasoning) ? result.reasoning.join('\n') : result.reasoning,
      };
    } catch (error) {
      console.error('AI Thinking Service Error:', error);
      throw new Error(`AI thinking generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  async testConnection(): Promise<boolean> {
    try {
      const result = await this.generateResponse('Say "Hello, AI service is working!"');
      return result.text.toLowerCase().includes('hello');
    } catch (error) {
      console.error('AI Service connection test failed:', error);
      return false;
    }
  }

  private getConversationContext(chatId: string, maxMessages: number): ConversationContext {
    let context = this.conversationHistory.get(chatId);

    if (!context) {
      context = {
        chatId,
        messages: [],
        lastActivity: new Date()
      };
      this.conversationHistory.set(chatId, context);
    }

    // Clean up old conversations
    cleanupExpiredConversations(this.conversationHistory, this.MAX_HISTORY_AGE);

    // Limit message history to prevent context overflow
    context.messages = limitConversationMessages(context.messages, maxMessages);

    return context;
  }

  private addToConversationHistory(chatId: string, userMessage: UserMessage, assistantMessage: AssistantMessage): void {
    const context = this.conversationHistory.get(chatId);
    if (context) {
      context.messages.push(userMessage, assistantMessage);
      context.lastActivity = new Date();
    }
  }


  async generateWithMedia(
    prompt: string,
    mediaFiles: Array<{ data: Buffer; mediaType: string; filename?: string }>,
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

    const tools: any = {};

    if (useSearch) {
      tools.google_search = google.tools.googleSearch({});
    }

    if (useUrlContext) {
      tools.url_context = google.tools.urlContext({});
    }

    if (useCodeExecution) {
      tools.code_execution = google.tools.codeExecution({});
    }

    try {
      // Get conversation context if chatId is provided
      let messages: ModelMessage[] = [];

      if (chatId) {
        const context = this.getConversationContext(chatId, options.maxMessages || this.DEFAULT_MAX_MESSAGES);
        messages = [...context.messages];
      }

      // Build user message content with media
      const content: Array<TextPart | ImagePart | FilePart> = [
        { type: 'text', text: senderName ? `${senderName}: ${prompt}` : prompt }
      ];

      // Add media files to content
      for (const file of mediaFiles) {
        if (file.mediaType.startsWith('image/')) {
          content.push({
            type: 'image',
            image: file.data,
            mediaType: file.mediaType
          });
        } else {
          content.push({
            type: 'file',
            data: file.data,
            mediaType: file.mediaType,
            filename: file.filename
          });
        }
      }

      const userMessage: UserMessage = {
        role: 'user',
        content
      };
      messages.push(userMessage);

      const result = await generateText({
        model: google(model),
        system: systemPrompt,
        messages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
      });

      // Store the assistant's response in conversation history
      if (chatId) {
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: result.text
        };
        this.addToConversationHistory(chatId, userMessage, assistantMessage);
      }

      // Tool call detection for Google search
      let toolCalls = result.toolCalls || [];

      // If we have sources but no explicit tool calls, infer Google search was used
      if ((result.sources && result.sources.length > 0) ||
          (result.providerMetadata?.google?.groundingMetadata && !toolCalls.length)) {
        toolCalls.push({
          toolCallId: 'google-search-inferred',
          toolName: 'google_search',
          args: { query: 'search query inferred from sources' }
        } as any);
      }

      return {
        text: result.text,
        sources: result.sources,
        groundingMetadata: result.providerMetadata?.google?.groundingMetadata,
        toolCalls: toolCalls,
        toolResults: result.toolResults,
      };
    } catch (error) {
      console.error('AI Media Service Error:', error);
      throw new Error(`AI media generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
}