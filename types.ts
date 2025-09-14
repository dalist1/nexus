
export type UserMessage = {
  role: 'user';
  content: string | Array<TextPart | ImagePart | FilePart>;
};

export type AssistantMessage = {
  role: 'assistant';
  content: string;
};

export type SystemMessage = {
  role: 'system';
  content: string;
};

export type ModelMessage = UserMessage | AssistantMessage | SystemMessage;

export type TextPart = {
  type: 'text';
  text: string;
};

export type ImagePart = {
  type: 'image';
  image: any;
  mediaType?: string;
};

export type FilePart = {
  type: 'file';
  data: any;
  mediaType: string;
  filename?: string;
};

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

export interface AIResponse {
  text: string;
  sources?: any[];
  groundingMetadata?: any;
  toolCalls?: any[];
  toolResults?: any[];
  reasoning?: string;
}

export type MessageRequest = {
  recipient: string;
  message?: string;
  media_path?: string;
};

export type ApiResponse = {
  success: boolean;
  message: string;
};

export type HealthResponse = {
  status: string;
  connected: boolean;
  user: string | null;
  aiServiceConnected: boolean;
};

export type AIRequest = {
  recipient: string;
  prompt: string;
  useSearch?: boolean;
  useUrlContext?: boolean;
  useCodeExecution?: boolean;
  useThinking?: boolean;
};

export type ConversationStatsRequest = {
  chatId: string;
};

export type ClearConversationRequest = {
  chatId: string;
};

export interface MessageData {
  timestamp: string;
  direction: string;
  sender: string;
  chat: string;
  messageType: string;
  content: string;
}