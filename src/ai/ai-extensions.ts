// AI Service extension methods for media and thinking features
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import {
  UserMessage,
  AssistantMessage,
  ModelMessage,
  AIServiceOptions,
  ConversationContext,
  AIResponse
} from '../../types';
import { getMediaType } from './ai-utils';

/**
 * Generate AI response with thinking mode (reasoning)
 */
export async function generateWithThinking(
  prompt: string,
  options: AIServiceOptions & { thinkingBudget?: number; includeThoughts?: boolean } = {},
  chatId?: string,
  senderName?: string,
  conversationHistory?: Map<string, ConversationContext>,
  getConversationContext?: (chatId: string, maxMessages: number) => ConversationContext,
  addToConversationHistory?: (chatId: string, userMessage: UserMessage, assistantMessage: AssistantMessage) => void,
  defaultModel?: string,
  defaultMaxMessages?: number
): Promise<AIResponse> {
  const {
    model = defaultModel || 'gemini-2.5-flash',
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

    if (chatId && getConversationContext) {
      const context = getConversationContext(chatId, options.maxMessages || defaultMaxMessages || 20);
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
    if (chatId && addToConversationHistory) {
      const assistantMessage: AssistantMessage = {
        role: 'assistant',
        content: result.text
      };
      addToConversationHistory(chatId, userMessage, assistantMessage);
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
      content: result.text,
      sources: result.sources?.map(source => ({
        sourceType: (source as any).sourceType || 'url' as const,
        id: source.id,
        url: (source as any).url,
        title: source.title,
        filename: (source as any).filename,
        mediaType: (source as any).mediaType,
        providerMetadata: source.providerMetadata
      })),
      reasoning: Array.isArray(result.reasoning)
        ? result.reasoning.map((r: any) => r.text).join('\n')
        : result.reasoning,
      toolCalls: toolCalls.map(tc => ({
        id: tc.toolCallId,
        name: tc.toolName,
        parameters: (tc as any).args as Record<string, unknown>
      })),
      providerMetadata: result.providerMetadata
    };
  } catch (error) {
    console.error('AI Thinking Service Error:', error);
    throw new Error(`AI thinking generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate AI response with files
 */
export async function generateWithFiles(
  prompt: string,
  filePaths: string[],
  options: AIServiceOptions = {}
): Promise<AIResponse> {
  const {
    model = 'gemini-2.5-flash',
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
      content: result.text,
      sources: result.sources?.map(source => ({
        sourceType: (source as any).sourceType || 'url' as const,
        id: source.id,
        url: (source as any).url,
        title: source.title,
        filename: (source as any).filename,
        mediaType: (source as any).mediaType,
        providerMetadata: source.providerMetadata
      })),
      reasoning: Array.isArray(result.reasoning)
        ? result.reasoning.map((r: any) => r.text).join('\n')
        : result.reasoning,
      toolCalls: toolCalls.map(tc => ({
        id: tc.toolCallId,
        name: tc.toolName,
        parameters: (tc as any).args as Record<string, unknown>
      })),
      providerMetadata: result.providerMetadata
    };
  } catch (error) {
    console.error('AI Service File Error:', error);
    throw new Error(`AI file generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate AI response with media files
 */
export async function generateWithMedia(
  prompt: string,
  mediaFiles: Array<{ data: Buffer; mediaType: string; filename?: string }>,
  options: AIServiceOptions = {},
  chatId?: string,
  senderName?: string,
  conversationHistory?: Map<string, ConversationContext>,
  getConversationContext?: (chatId: string, maxMessages: number) => ConversationContext,
  addToConversationHistory?: (chatId: string, userMessage: UserMessage, assistantMessage: AssistantMessage) => void,
  defaultModel?: string,
  defaultMaxMessages?: number
): Promise<AIResponse> {
  const {
    model = defaultModel || 'gemini-2.5-flash',
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

    if (chatId && getConversationContext) {
      const context = getConversationContext(chatId, options.maxMessages || defaultMaxMessages || 20);
      messages = [...context.messages];
    }

    // Build user message content with media
    const content: Array<any> = [
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
    if (chatId && addToConversationHistory) {
      const assistantMessage: AssistantMessage = {
        role: 'assistant',
        content: result.text
      };
      addToConversationHistory(chatId, userMessage, assistantMessage);
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
      content: result.text,
      sources: result.sources?.map(source => ({
        sourceType: (source as any).sourceType || 'url' as const,
        id: source.id,
        url: (source as any).url,
        title: source.title,
        filename: (source as any).filename,
        mediaType: (source as any).mediaType,
        providerMetadata: source.providerMetadata
      })),
      reasoning: Array.isArray(result.reasoning)
        ? result.reasoning.map((r: any) => r.text).join('\n')
        : result.reasoning,
      toolCalls: toolCalls.map(tc => ({
        id: tc.toolCallId,
        name: tc.toolName,
        parameters: (tc as any).args as Record<string, unknown>
      })),
      providerMetadata: result.providerMetadata
    };
  } catch (error) {
    console.error('AI Media Service Error:', error);
    throw new Error(`AI media generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}