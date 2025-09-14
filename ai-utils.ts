// AI Service utility functions

/**
 * Get media type from file extension
 */
export function getMediaType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  const mediaTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'avi': 'video/avi',
    'mov': 'video/mov',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    'm4a': 'audio/m4a',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'json': 'application/json',
    'xml': 'application/xml',
  };

  return mediaTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Clean up expired conversations from memory
 */
export function cleanupExpiredConversations(
  conversationHistory: Map<string, any>,
  maxAge: number
): void {
  const now = Date.now();
  for (const [chatId, context] of conversationHistory.entries()) {
    if (now - context.lastActivity.getTime() > maxAge) {
      conversationHistory.delete(chatId);
    }
  }
}

/**
 * Limit conversation messages to prevent context overflow
 */
export function limitConversationMessages(
  messages: any[],
  maxMessages: number
): any[] {
  if (messages.length > maxMessages * 2) {
    // Keep system messages and recent messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const recentMessages = messages.slice(-maxMessages * 2);
    return [...systemMessages, ...recentMessages];
  }
  return messages;
}