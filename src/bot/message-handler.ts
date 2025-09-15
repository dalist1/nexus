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
    if (messages.type !== 'notify' && messages.type !== 'append') return;

    for (const m of messages.messages) {
      if (!m.message) continue;

      const messageType = Object.keys(m.message)[0] as keyof proto.IMessage;
      const chatJid = m.key.remoteJid!;
      const isFromMe = m.key.fromMe || false;
      let sender = isFromMe ? this.getSock()!.user!.id : (m.key.participant || chatJid);
      const timestamp = new Date((m.messageTimestamp as number) * 1000);

      console.log(`Message details:`, {
        chatJid: chatJid.split('@')[0],
        isFromMe,
        fromMeKey: m.key.fromMe,
        participant: m.key.participant?.split('@')[0],
        sender: sender.split('@')[0],
        botUserId: this.getSock()?.user?.id?.split('@')[0],
        messageType
      });

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


      console.log(`Processing message: "${content}" from ${sender.split('@')[0]} (isFromMe: ${isFromMe})`);
      console.log(`shouldTriggerAI result: ${shouldTriggerAI(content)} for content: "${content}"`);

      let isAIInteraction = false;
      if (!isFromMe && shouldTriggerAI(content)) {
        isAIInteraction = true;
        console.log(`👀 AI trigger detected from ${sender.split('@')[0]}: "${content}"`);

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


          console.log(`About to call handleAIMessage for: "${content}"`);
          await this.handleAIMessage(chatJid, content, sender, mediaBuffer, actualMediaType, actualFilename);
          console.log(`✅ handleAIMessage completed for: "${content}"`);
        } catch (error) {
          console.error(`❌ Failed to process AI message from ${sender.split('@')[0]}:`, error);
          Logger.error('Failed to process AI message', error);

          try {
            await this.getSock()!.sendMessage(chatJid, {
              text: '❌ Sorry, I encountered an error processing your request. Please try again later.'
            });
          } catch (sendError) {
            console.error('Failed to send error message:', sendError);
          }
        }
      }

      console.log('Attempting to save message to Google Sheets...');
      this.saveMessageToSheets({
        timestamp: timestamp.toISOString(),
        direction: isFromMe ? '→' : '←',
        sender: sender.split('@')[0],
        chat: chatJid.split('@')[0],
        messageType: mediaType || 'text',
        content: content || '[Media]'
      }).catch(error => {
        console.error('⚠️ Failed to save message to sheets:', error);
        Logger.error('Failed to save message to sheets', error);
      });

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
    console.log(`handleAIMessage called with content: "${content}"`);

    const { useSearch, useUrlContext, useCodeExecution, useThinking, prompt, isHelp } = parseAICommand(content);
    console.log(`Parsed command - prompt: "${prompt}", useSearch: ${useSearch}, useThinking: ${useThinking}`);

    if (!prompt.trim()) {
      console.log('⚠️ Empty prompt, sending error message');
      await this.getSock()!.sendMessage(chatJid, {
        text: '❌ Please provide a message.'
      });
      return;
    }

    console.log('Setting presence to composing');
    await this.getSock()!.sendPresenceUpdate('composing', chatJid);


    try {
      let response;
      const senderName = sender.split('@')[0];

      console.log(`🚀 Processing AI request from ${senderName}: "${prompt.substring(0, 50)}..."`);

      if (mediaBuffer && mediaType) {
        console.log('Calling generateWithMedia');
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
          console.log('Calling generateWithThinking');
          response = await this.aiService.generateWithThinking(prompt, {
            useSearch,
            useUrlContext,
            useCodeExecution,
            systemPrompt: 'You are a helpful WhatsApp assistant. Provide clear, concise, and informative responses. Use emojis appropriately to make responses engaging.'
          }, chatJid, senderName);
        } else {
          console.log('Calling generateResponse');
          response = await this.aiService.generateResponse(prompt, {
            useSearch,
            useUrlContext,
            useCodeExecution,
            systemPrompt: 'You are a helpful WhatsApp assistant. Provide clear, concise, and informative responses. Use emojis appropriately to make responses engaging.'
          }, chatJid, senderName);
        }
      }

      console.log('AI service returned response:', {
        hasContent: !!response.content,
        contentLength: response.content?.length || 0,
        hasSources: !!response.sources?.length,
        hasToolCalls: !!response.toolCalls?.length
      });

      let responseText = response.content || 'No response generated';

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

      console.log(`Sending response to ${senderName}: "${responseText.substring(0, 100)}..."`);
      console.log(`Response length: ${responseText.length} chars`);

      const sock = this.getSock();
      if (!sock) {
        console.error('❌ No WhatsApp socket available!');
        throw new Error('WhatsApp socket not available');
      }

      await sock.sendMessage(chatJid, { text: responseText });
      console.log(`✅ AI response sent to ${senderName} (${responseText.length} chars)`);

      this.saveMessageToSheets({
        timestamp: new Date().toISOString(),
        direction: '→',
        sender: 'AI Bot',
        chat: chatJid.split('@')[0],
        messageType: 'text',
        content: responseText
      }).catch(error => {
        Logger.error('Failed to save AI response to sheets', error);
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
    console.log(`Google Sheets service available: ${sheetsService ? 'YES' : 'NO'}`);

    if (!sheetsService) {
      console.log('No Google Sheets service - skipping save');
      return;
    }

    try {
      console.log(`Saving message to sheets: ${messageData.sender} -> "${messageData.content.substring(0, 50)}..."`);
      await sheetsService.appendMessage(messageData as MessageData);
      console.log('✅ Message saved to Google Sheets successfully');

      Logger.database('Message saved to Google Sheets', {
        sender: messageData.sender,
        messageType: messageData.messageType
      });
    } catch (error) {
      console.error('❌ Failed to save to Google Sheets:', error);
      Logger.error('Failed to save message to sheets', error);
    }
  }
}