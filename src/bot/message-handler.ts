import { BaileysEventMap, proto, WASocket } from '@whiskeysockets/baileys';
import { AIService } from '../ai/ai-service';
import { GoogleSheetsService } from '../sheets/sheets-service';
import { Logger } from '../utils/logger';
import { MessageData } from '../../types';
import {
  shouldTriggerAI,
  parseAICommand,
  formatToolUsage
} from '../utils/whatsapp-utils';

export class MessageHandler {
  constructor(
    private aiService: AIService,
    private getSock: () => WASocket | null,
    private getSheetsService: () => GoogleSheetsService | null
  ) {}

  async handleMessage(messages: BaileysEventMap['messages.upsert']): Promise<void> {
    if (messages.type !== 'notify') return;

    for (const m of messages.messages) {
      if (!m.message) continue;

      const messageType = Object.keys(m.message)[0] as keyof proto.IMessage;
      const chatJid = m.key.remoteJid!;
      const isFromMe = m.key.fromMe || false;
      let sender = isFromMe ? this.getSock()!.user!.id : (m.key.participant || chatJid);
      const timestamp = new Date((m.messageTimestamp as number) * 1000);

      let content = '';
      let mediaType: string | undefined;
      let filename: string | undefined;

      const messageMap: Record<string, () => void> = {
        conversation: () => { content = m.message!.conversation!; },
        extendedTextMessage: () => { content = m.message!.extendedTextMessage!.text!; },
        imageMessage: () => {
          mediaType = 'image';
          content = m.message!.imageMessage!.caption || '[Image]';
          filename = content;
        },
        videoMessage: () => {
          mediaType = 'video';
          content = m.message!.videoMessage!.caption || '[Video]';
          filename = content;
        },
        audioMessage: () => {
          mediaType = 'audio';
          content = '[Audio]';
          filename = 'audio';
        },
        documentMessage: () => {
          mediaType = 'document';
          filename = m.message!.documentMessage!.fileName || 'document';
          content = m.message!.documentMessage!.caption || '[Document]';
        }
      };

      if (messageMap[messageType]) {
        messageMap[messageType]();
      } else {
        if (messageType === 'protocolMessage' || messageType === 'senderKeyDistributionMessage' || messageType === 'messageContextInfo') {
          continue;
        }
        content = '[Unknown message type]';
      }


      let isAIInteraction = false;
      if (shouldTriggerAI(content)) {
        isAIInteraction = true;
        try {
          let mediaBuffer: Buffer | undefined;
          let actualMediaType: string | undefined;
          let actualFilename: string | undefined;

          if (mediaType && m.message) {
            try {
              Logger.message('Media message detected', { sender, messageType: `${mediaType} - ${filename}` });
            } catch (error) {
              Logger.error('Failed to process media', error);
            }
          }
          await this.saveMessageToSheets({
            timestamp: timestamp.toISOString(),
            direction: isFromMe ? '→' : '←',
            sender: sender.split('@')[0],
            chat: chatJid.split('@')[0],
            messageType: mediaType || 'text',
            content: content || '[Media]'
          });

          await this.handleAIMessage(chatJid, content, sender, mediaBuffer, actualMediaType, actualFilename);
        } catch (error) {
          Logger.error('Failed to process AI message', error);
        }
      }

      try {
        const direction = isFromMe ? '→' : '←';
        const logMsg = mediaType
          ? `[${timestamp.toLocaleString()}] ${direction} ${sender}: [${mediaType}: ${filename}] ${content}`
          : `[${timestamp.toLocaleString()}] ${direction} ${sender}: ${content}`;

        console.log(logMsg);

        Logger.message('Received message', {
          sender: sender.split('@')[0],
          chat: chatJid.includes('@g.us') ? 'group' : 'direct',
          messageType: messageType,
          content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
        });
      } catch (error) {
        Logger.error('Error logging message', error);
      }
    }
  }

  private async handleAIMessage(chatJid: string, content: string, sender: string, mediaBuffer?: Buffer, mediaType?: string, filename?: string): Promise<void> {
    const { useSearch, useUrlContext, useCodeExecution, useThinking, prompt, isHelp } = parseAICommand(content);

    if (!prompt.trim()) {
      await this.getSock()!.sendMessage(chatJid, {
        text: '❌ Please provide a message.'
      });
      return;
    }

    await this.getSock()!.sendPresenceUpdate('composing', chatJid);

    try {
      let response;
      const senderName = sender.split('@')[0];

      console.log(`🤖 Processing AI request from ${senderName}: "${prompt.substring(0, 50)}..."`);

      if (mediaBuffer && mediaType) {
        response = await this.aiService.generateWithMedia(prompt, [
          { data: mediaBuffer, mediaType, filename }
        ], {
          useSearch,
          useUrlContext,
          useCodeExecution,
          systemPrompt: 'You are a helpful WhatsApp assistant. Analyze images, documents, and media when provided. Provide clear, concise, and informative responses. Use emojis appropriately to make responses engaging.'
        }, chatJid, senderName);
      } else {
        if (useThinking) {
          response = await this.aiService.generateWithThinking(prompt, {
            useSearch,
            useUrlContext,
            useCodeExecution,
            systemPrompt: 'You are a helpful WhatsApp assistant. Provide clear, concise, and informative responses. Use emojis appropriately to make responses engaging.'
          }, chatJid, senderName);
        } else {
          response = await this.aiService.generateResponse(prompt, {
            useSearch,
            useUrlContext,
            useCodeExecution,
            systemPrompt: 'You are a helpful WhatsApp assistant. Provide clear, concise, and informative responses. Use emojis appropriately to make responses engaging.'
          }, chatJid, senderName);
        }
      }

      let responseText = response.content;
      if (response.sources && response.sources.length > 0) {
        responseText += '\n\n📚 Sources:';
        response.sources.forEach((source, index) => {
          responseText += `\n${index + 1}. ${source.url || 'Web Search'}`;
        });
      }

      const toolsUsed = formatToolUsage(response.toolCalls || []);

      if (toolsUsed.length > 0) {
        responseText += `\n\n🛠️ Tools used: ${toolsUsed.join(', ')}`;
      }

      await this.getSock()!.sendMessage(chatJid, { text: responseText });

      console.log(`✅ AI response sent to ${senderName} (${responseText.length} chars)`);
      await this.saveMessageToSheets({
        timestamp: new Date().toISOString(),
        direction: '→',
        sender: 'AI Bot',
        chat: chatJid.split('@')[0],
        messageType: 'text',
        content: responseText
      });

      Logger.ai('AI response sent', {
        sender: sender.split('@')[0],
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        responseLength: responseText.length
      });
    } catch (error) {
      console.error(`❌ AI error for ${sender.split('@')[0]}:`, error);
      Logger.error('AI message handling error', error);
      await this.getSock()!.sendMessage(chatJid, {
        text: '❌ Sorry, I encountered an error processing your request. Please try again later.'
      });
    } finally {
      await this.getSock()!.sendPresenceUpdate('available', chatJid);
    }
  }

  private async saveMessageToSheets(messageData: {
    timestamp: string;
    direction: string;
    sender: string;
    chat: string;
    messageType: string;
    content: string;
  }): Promise<void> {
    const sheetsService = this.getSheetsService();
    if (!sheetsService) return;

    try {
      await sheetsService.appendMessage(messageData as MessageData);
      Logger.database('Message saved to Google Sheets', {
        sender: messageData.sender,
        messageType: messageData.messageType
      });
    } catch (error) {
      Logger.error('Failed to save message to sheets', error);
    }
  }
}