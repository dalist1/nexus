// Import and use core AI SDK message types
import type {
  CoreMessage,
  CoreUserMessage,
  CoreAssistantMessage,
  TextPart
} from 'ai';

// Re-export AI SDK types with proper export type syntax
export type ModelMessage = CoreMessage;
export type UserMessage = CoreUserMessage;
export type AssistantMessage = CoreAssistantMessage;

// Re-export message part types
export type { TextPart };

// Application-specific types
export interface AIServiceOptions {
  model?: string;
  systemPrompt?: string;
  useSearch?: boolean;
  useUrlContext?: boolean;
  useCodeExecution?: boolean;
  maxMessages?: number;
}

export interface ConversationContext {
  chatId: string;
  messages: ModelMessage[];
  lastActivity: Date;
}

// Source type based on AI SDK documentation - flexible to handle different source types
export interface Source {
  sourceType: 'url' | 'document';
  id: string;
  url?: string; // Optional for document sources
  title?: string;
  filename?: string; // For document sources
  mediaType?: string; // For document sources
  providerMetadata?: Record<string, any>;
}

export interface AIResponse {
  content: string;
  sources?: Source[];
  reasoning?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    parameters: Record<string, unknown>;
  }>;
  providerMetadata?: Record<string, any>;
}

export interface MessageRequest {
  recipient: string;
  message?: string;
  media_path?: string;
}

export interface ApiResponse {
  success: boolean;
  message: string;
}

export interface HealthResponse {
  status: string;
  whatsapp: string;
  ai: string;
  sheets: string;
  timestamp: string;
}

export interface AIRequest {
  recipient: string;
  prompt: string;
  useSearch?: boolean;
  useUrlContext?: boolean;
  useCodeExecution?: boolean;
  useThinking?: boolean;
}

export interface ConversationStatsRequest {
  chatId: string;
}

export interface ClearConversationRequest {
  chatId: string;
}

export interface MessageData {
  timestamp: string;
  direction: string;
  sender: string;
  chat: string;
  messageType: string;
  content: string;
}